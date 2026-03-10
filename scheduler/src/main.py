"""主入口"""

import logging
import sys
import threading

from src.api import run_api
from src.config import config
from src.cron import start_scheduler

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)


def main():
    """主函数 - 同时启动定时器和 HTTP 服务"""
    logger.info("=" * 50)
    logger.info("🚀 FinPal Scheduler 启动")
    logger.info("=" * 50)
    
    # 启动定时调度器（后台线程）
    scheduler_thread = threading.Thread(target=start_scheduler, daemon=True)
    scheduler_thread.start()
    logger.info("✅ 定时调度器已启动（后台线程）")
    
    # 启动 HTTP API（主线程，阻塞）
    logger.info("✅ HTTP 服务即将启动...")
    run_api()


if __name__ == "__main__":
    main()
