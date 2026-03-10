"""配置管理"""

import os
from dataclasses import dataclass


@dataclass
class Config:
    """应用配置"""
    
    # 数据库
    database_url: str = "postgresql://finpal:finpal@localhost:5432/finpal"
    
    # HTTP 服务
    http_host: str = "0.0.0.0"
    http_port: int = 8000
    
    # 同步配置
    sync_time: str = "18:00"  # 每天同步时间
    
    @classmethod
    def from_env(cls) -> "Config":
        """从环境变量加载配置"""
        return cls(
            database_url=os.getenv("DATABASE_URL", cls.database_url),
            http_host=os.getenv("HTTP_HOST", cls.http_host),
            http_port=int(os.getenv("HTTP_PORT", cls.http_port)),
            sync_time=os.getenv("SYNC_TIME", cls.sync_time),
        )


# 全局配置实例
config = Config.from_env()
