"""数据库操作 - 原始 SQL"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any

import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

from src.config import config

logger = logging.getLogger(__name__)


class Database:
    """PostgreSQL 数据库操作"""
    
    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or config.database_url
        logger.info(f"🔌 正在连接数据库: {self.database_url.split('@')[-1]}") # 隐藏密码
        self._ensure_tables()
    
    def _get_conn(self):
        """获取数据库连接"""
        return psycopg2.connect(self.database_url)
    
    def _ensure_tables(self):
        """确保表结构存在（如果不存在则创建）"""
        create_tables_sql = """
        -- 基金基本信息表
        CREATE TABLE IF NOT EXISTS fund_basic (
            code VARCHAR(10) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            category VARCHAR(50),
            manager VARCHAR(50),
            company VARCHAR(100),
            established_date TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_fund_basic_name ON fund_basic(name);
        
        -- 基金净值历史表
        CREATE TABLE IF NOT EXISTS fund_nav (
            id SERIAL PRIMARY KEY,
            fund_code VARCHAR(10) NOT NULL,
            nav_date TIMESTAMP NOT NULL,
            unit_nav DECIMAL(10, 4) NOT NULL,
            accum_nav DECIMAL(10, 4) NOT NULL,
            daily_return DECIMAL(6, 2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(fund_code, nav_date)
        );
        CREATE INDEX IF NOT EXISTS idx_fund_nav_code ON fund_nav(fund_code);
        CREATE INDEX IF NOT EXISTS idx_fund_nav_date ON fund_nav(nav_date);
        """
        
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(create_tables_sql)
            conn.commit()
        logger.info("✅ 数据库表检查完成")
    
    # ========== 基金基本信息操作 ==========
    
    def save_fund_basic(self, code: str, name: str, category: str = None, 
                       manager: str = None, company: str = None) -> bool:
        """保存或更新基金基本信息"""
        sql = """
        INSERT INTO fund_basic (code, name, category, manager, company, updated_at)
        VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            manager = EXCLUDED.manager,
            company = EXCLUDED.company,
            updated_at = CURRENT_TIMESTAMP
        """
        
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (code, name, category, manager, company))
            conn.commit()
        return True
    
    def save_fund_basic_batch(self, funds: List[Dict[str, Any]]) -> int:
        """批量保存基金基本信息"""
        sql = """
        INSERT INTO fund_basic (code, name, category, updated_at)
        VALUES %s
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            updated_at = CURRENT_TIMESTAMP
        """
        
        # 准备数据
        values = [
            (f["code"], f["name"], f.get("category"), datetime.now())
            for f in funds
        ]
        
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                execute_values(cur, sql, values, page_size=1000)
            conn.commit()
        
        return len(funds)
    
    def get_fund_count(self) -> int:
        """获取基金数量"""
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM fund_basic")
                return cur.fetchone()[0]
    
    def get_active_fund_codes(self) -> List[str]:
        """获取所有持仓基金的代码"""
        # 注意：user_holdings 表由主应用管理，但属于同一个数据库
        sql = "SELECT DISTINCT fund_code FROM user_holdings"
        try:
            with self._get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql)
                    return [row[0] for row in cur.fetchall()]
        except Exception as e:
            logger.error(f"获取持仓基金失败: {e}")
            return []

    def get_similar_funds(self, code: str, limit: int = 5) -> List[Dict[str, Any]]:
        """获取同类型或同公司的基金"""
        sql = """
        WITH target AS (
            SELECT category, company FROM fund_basic WHERE code = %s
        )
        (SELECT code, name, category, company FROM fund_basic, target 
         WHERE fund_basic.category = target.category AND fund_basic.code != %s
         LIMIT %s)
        UNION
        (SELECT code, name, category, company FROM fund_basic, target 
         WHERE fund_basic.company = target.company AND fund_basic.code != %s
         LIMIT %s)
        """
        try:
            with self._get_conn() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(sql, (code, code, limit, code, limit))
                    return cur.fetchall()
        except Exception as e:
            logger.error(f"获取相似基金失败: {e}")
            return []
    
    # ========== 净值操作 ==========
    
    def save_nav(self, fund_code: str, nav_date: datetime, 
                 unit_nav: Decimal, accum_nav: Decimal, 
                 daily_return: Decimal = None) -> bool:
        """保存净值数据"""
        sql = """
        INSERT INTO fund_nav (fund_code, nav_date, unit_nav, accum_nav, daily_return)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (fund_code, nav_date) DO NOTHING
        """
        
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (fund_code, nav_date, unit_nav, accum_nav, daily_return))
                inserted = cur.rowcount > 0
            conn.commit()
        return inserted
    
    def save_nav_batch(self, navs: List[Dict[str, Any]]) -> int:
        """批量保存净值数据"""
        sql = """
        INSERT INTO fund_nav (fund_code, nav_date, unit_nav, accum_nav, daily_return)
        VALUES %s
        ON CONFLICT (fund_code, nav_date) DO NOTHING
        """
        
        # 准备数据
        values = [
            (n["fund_code"], n["nav_date"], n["unit_nav"], 
             n["accum_nav"], n.get("daily_return"))
            for n in navs
        ]
        
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                execute_values(cur, sql, values, page_size=1000)
                # execute_values 不返回 affected rows，我们估算
            conn.commit()
        
        return len(values)
    
    def get_nav_count(self) -> int:
        """获取净值记录数量"""
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM fund_nav")
                return cur.fetchone()[0]

    def get_latest_nav_date(self, fund_code: str) -> Optional[datetime]:
        """获取基金最新的净值日期"""
        sql = "SELECT MAX(nav_date) FROM fund_nav WHERE fund_code = %s"
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (fund_code,))
                res = cur.fetchone()
                return res[0] if res else None
    
    # ========== 统计信息 ==========
    
    def get_stats(self) -> Dict[str, Any]:
        """获取数据库统计信息"""
        with self._get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT COUNT(*) as fund_count FROM fund_basic")
                fund_count = cur.fetchone()["fund_count"]
                
                cur.execute("SELECT COUNT(*) as nav_count FROM fund_nav")
                nav_count = cur.fetchone()["nav_count"]
                
                # 最新同步时间
                cur.execute("""
                    SELECT MAX(updated_at) as last_sync 
                    FROM fund_basic
                """)
                last_sync = cur.fetchone()["last_sync"]
        
        return {
            "fund_count": fund_count,
            "nav_count": nav_count,
            "last_sync": last_sync,
        }
