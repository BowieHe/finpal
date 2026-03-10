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
    
    # 2. 同步热门基金净值（前 200 只）
    try:
        logger.info("🔄 开始同步热门基金净值...")
        funds = db.get_fund_count()
        logger.info(f"   当前共有 {funds} 只基金")
        
        # 获取前 200 只基金同步（简化：按字母顺序取前 200）
        # 实际生产中可以按规模、热度等排序
        logger.info("   （简化：只同步部分基金作为示例）")
        
        # 这里可以遍历所有基金，但耗时较长
        # 示例：只同步几只常见基金
        sample_codes = ["000001", "000002", "110001", "160106"]
        for code in sample_codes:
            try:
                sync_fund_nav(db, code, period="1月")
                time.sleep(0.5)  # 避免请求过快
            except Exception as e:
                logger.error(f"   ❌ 同步 {code} 失败: {e}")
                continue
        
        logger.info("✅ 热门基金净值同步完成")
        
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
    
    # 启动时先执行一次（初始化）
    logger.info("🚀 启动时先执行一次同步...")
    sync_job()
    
    # 主循环
    logger.info("⏳ 进入定时等待循环...")
    while True:
        try:
            schedule.run_pending()
            time.sleep(60)  # 每分钟检查一次
        except Exception as e:
            logger.error(f"❌ 调度器错误: {e}")
            time.sleep(60)
