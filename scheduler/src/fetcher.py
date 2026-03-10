"""akshare 数据获取"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Any

import akshare as ak
import pandas as pd

logger = logging.getLogger(__name__)


class FundFetcher:
    """基金数据获取器"""
    
    @staticmethod
    def get_all_fund_codes() -> List[Dict[str, str]]:
        """获取所有基金代码列表"""
        logger.info("🔄 获取基金列表...")
        
        try:
            df = ak.fund_name_em()
            df = df.rename(columns={
                "基金代码": "code",
                "基金简称": "name",
                "基金类型": "category",
            })
            
            funds = df[["code", "name", "category"]].to_dict("records")
            logger.info(f"✅ 获取到 {len(funds)} 只基金")
            return funds
            
        except Exception as e:
            logger.error(f"❌ 获取基金列表失败: {e}")
            return []
    
    @staticmethod
    def get_fund_nav_history(code: str, period: str = "1年") -> List[Dict[str, Any]]:
        """获取基金历史净值
        
        Args:
            code: 基金代码
            period: 时间范围（未使用，akshare 返回全部）
        """
        logger.info(f"🔄 获取基金 {code} 净值历史...")
        
        try:
            df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
            
            navs = []
            for _, row in df.iterrows():
                nav_date = pd.to_datetime(row["净值日期"])
                
                # 解析涨跌幅
                daily_return = None
                if "日增长率" in row and pd.notna(row["日增长率"]):
                    try:
                        daily_return = Decimal(str(row["日增长率"]))
                    except (ValueError, TypeError):
                        pass
                
                nav = {
                    "fund_code": code,
                    "nav_date": nav_date,
                    "unit_nav": Decimal(str(row["单位净值"])),
                    "accum_nav": Decimal(str(row.get("累计净值", row["单位净值"]))),
                    "daily_return": daily_return,
                }
                navs.append(nav)
            
            logger.info(f"✅ 基金 {code} 获取到 {len(navs)} 条净值")
            return navs
            
        except Exception as e:
            logger.error(f"❌ 获取基金 {code} 净值失败: {e}")
            return []
    
    @staticmethod
    def get_realtime_estimate(code: str) -> Dict[str, Any]:
        """获取基金实时估值"""
        try:
            df = ak.fund_value_estimate_em()
            fund_data = df[df["基金代码"] == code]
            
            if fund_data.empty:
                return None
            
            row = fund_data.iloc[0]
            
            return {
                "fund_code": code,
                "name": row.get("基金名称", ""),
                "unit_nav": row.get("单位净值"),
                "estimate_nav": row.get("估算净值"),
                "estimate_return": row.get("估算增长率"),
                "nav_date": row.get("净值日期"),
            }
            
        except Exception as e:
            logger.error(f"❌ 获取实时估值失败: {e}")
            return None


# ===== 便捷函数 =====

def sync_all_funds(db) -> int:
    """同步所有基金基本信息"""
    fetcher = FundFetcher()
    funds = fetcher.get_all_fund_codes()
    
    if not funds:
        return 0
    
    count = db.save_fund_basic_batch(funds)
    logger.info(f"✅ 同步完成，共 {count} 只基金")
    return count


def sync_fund_nav(db, code: str, period: str = "1年") -> int:
    """同步单只基金净值"""
    fetcher = FundFetcher()
    navs = fetcher.get_fund_nav_history(code, period)
    
    if not navs:
        return 0
    
    count = db.save_nav_batch(navs)
    logger.info(f"✅ 基金 {code} 同步完成，共 {count} 条净值")
    return count
