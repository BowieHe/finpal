#!/bin/bash

# FinPal 项目初始化脚本

set -e

echo "🚀 FinPal 项目初始化"
echo "===================="

# 检查命令
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 未安装"
        return 1
    else
        echo "✅ $1 已安装"
        return 0
    fi
}

echo ""
echo "📋 检查环境..."
check_command node || exit 1
check_command pnpm || exit 1
check_command python3 || exit 1

# 获取 Python 版本
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "✅ Python 版本: $PYTHON_VERSION"

# 检查 Node 版本
NODE_VERSION=$(node --version)
echo "✅ Node 版本: $NODE_VERSION"

echo ""
echo "📦 安装前端依赖..."
pnpm install

echo ""
echo "🐍 设置 Python 环境..."
cd apps/data-service

# 创建虚拟环境
if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
echo "安装 Python 依赖..."
pip install -e ".[dev]"

echo ""
echo "🗄️ 初始化数据库..."
python -m data_service.cli --init

echo ""
echo "📊 同步基金数据..."
echo "这将下载基金列表，可能需要几分钟..."
python -m data_service.cli --sync-list

echo ""
echo "✅ 初始化完成！"
echo ""
echo "🎉 启动项目:"
echo ""
echo "  方法 1 - 同时启动（推荐）:"
echo "    cd ../.. && pnpm dev"
echo ""
echo "  方法 2 - 分别启动:"
echo "    终端 1: pnpm dev:api"
echo "    终端 2: pnpm dev:web"
echo ""
echo "📍 访问地址:"
echo "  前端: http://localhost:3000"
echo "  API:  http://localhost:8000"
echo "  文档: http://localhost:8000/docs"
