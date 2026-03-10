# FinPal Scheduler

基金数据定时同步服务。

## 环境要求

- Python 3.11+
- PostgreSQL 14+
- [uv](https://docs.astral.sh/uv/) (Python 包管理器)

## 安装 uv

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# 或者使用 pip
pip install uv
```

## 快速开始

### 1. 初始化项目

```bash
cd apps/scheduler

# 使用 uv 创建虚拟环境并安装依赖
uv sync

# 或者包含开发依赖
uv sync --extra dev
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 配置数据库连接
```

### 3. 运行

```bash
# 开发模式
uv run -m src.main

# 或者直接使用项目命令
uv run scheduler
```

## 常用命令

```bash
# 添加依赖
uv add akshare pandas

# 添加开发依赖
uv add --dev pytest black

# 更新依赖
uv sync --upgrade

# 锁定依赖版本
uv lock

# 运行测试
uv run pytest

# 运行脚本
uv run python -c "from src.fetcher import FundFetcher; f = FundFetcher(); print(len(f.get_all_fund_codes()))"
```

## 项目结构

```
scheduler/
├── src/
│   ├── __init__.py
│   ├── main.py         # 入口
│   ├── cron.py         # 定时任务
│   ├── api.py          # HTTP API
│   ├── database.py     # 数据库操作
│   ├── fetcher.py      # 数据获取
│   └── config.py       # 配置
├── pyproject.toml      # 项目配置
├── uv.lock            # 锁定文件（自动生成）
└── .python-version    # Python 版本
```

## Docker

```bash
# 构建镜像
docker build -t finpal-scheduler .

# 运行
docker run -e DATABASE_URL=... finpal-scheduler
```

## HTTP API

| 接口 | 方法 | 描述 |
|------|------|------|
| `/` | GET | 服务信息 |
| `/health` | GET | 健康检查 |
| `/trigger` | POST | 手动触发同步 |
| `/stats` | GET | 数据库统计 |

### 手动触发

```bash
curl -X POST http://localhost:8001/trigger
```
