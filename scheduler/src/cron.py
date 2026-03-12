"""定时任务定义"""

import logging
import time
from datetime import datetime

import schedule

from src.config import config
from src.database import Database
from src.fetcher import sync_all_funds, sync_fund_nav

logger = logging.getLogger(__name__)


def sync_job():
    """主同步任务 - 每天执行"""
    logger.info("=" * 50)
    logger.info(f"🚀 开始每日同步任务 - {datetime.now()}")
    logger.info("=" * 50)
    
    db = Database()
    
    # 1. 同步基金列表（如果有新基金）
    try:
        fund_count = sync_all_funds(db)
        logger.info(f"📊 基金列表同步完成: {fund_count} 只")
    except Exception as e:
        logger.error(f"❌ 基金列表同步失败: {e}")
    
    # 2. 同步活跃基金净值 (持有中 + 关联的)
    try:
        logger.info("🔄 开始同步活跃基金净值...")
        active_codes = db.get_active_fund_codes()
        logger.info(f"   当前共有 {len(active_codes)} 只持仓基金")
        
        for code in active_codes:
            try:
                # 增量同步
                sync_fund_nav(db, code, period="1月")
                # 顺便检查关联基金数据是否需要更新
                similar = db.get_similar_funds(code, limit=3)
                for s in similar:
                    sync_fund_nav(db, s["code"], period="2周")
                time.sleep(0.5)
            except Exception as e:
                logger.error(f"   ❌ 同步 {code} 失败: {e}")
                continue
        
        logger.info("✅ 活跃基金净值同步完成")
        
    except Exception as e:
        logger.error(f"❌ 净值同步失败: {e}")
    
    # 3. 输出统计
    try:
        stats = db.get_stats()
        logger.info("📈 当前数据库统计:")
        logger.info(f"   基金数量: {stats['fund_count']}")
        logger.info(f"   净值记录: {stats['nav_count']}")
        logger.info(f"   最后同步: {stats['last_sync']}")
    except Exception as e:
        logger.error(f"❌ 获取统计失败: {e}")
    
    logger.info("=" * 50)
    logger.info("✅ 每日同步任务完成")
    logger.info("=" * 50)


def start_scheduler():
    """启动定时调度器"""
    logger.info(f"⏰ 启动定时调度器，每天 {config.sync_time} 执行")
    
    # 注册定时任务
    schedule.every().day.at(config.sync_time).do(sync_job)
    
    # 启动时初始化检查
    try:
        db = Database()
        count = db.get_fund_count()
        logger.info(f"📊 启动检查: 当前基金基本信息数量 = {count}")
        if count == 0:
            logger.info("🚀 数据库为空，执行初始化同步基金列表...")
            sync_all_funds(db)
        else:
            logger.info("✅ 基金列表已存在，跳过初始化")
    except Exception as e:
        logger.error(f"❌ 启动初始化检查失败: {e}", exc_info=True)
    
    # 启动时执行一次同步（可选，如果是刚启动且有持仓）
    # sync_job()
    
    # 主循环
    logger.info("⏳ 进入定时等待循环...")
    while True:
        try:
            schedule.run_pending()
            time.sleep(60)  # 每分钟检查一次
        except Exception as e:
            logger.error(f"❌ 调度器错误: {e}")
            time.sleep(60)
