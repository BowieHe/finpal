ARG BASE_IMAGE=ghcr.io/astral-sh/uv:python3.11-bookworm-slim
FROM ${BASE_IMAGE}

WORKDIR /app

# 启用 uv 的编译缓存
ENV UV_COMPILE_BYTECODE=1

# 复制依赖文件
COPY pyproject.toml uv.lock ./

# 安装依赖
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-install-project --no-dev

# 复制项目代码
ADD . /app

# 安装项目
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev

# 添加到 PATH
ENV PATH="/app/.venv/bin:$PATH"

# 暴露 HTTP 端口
EXPOSE 8000

# 启动命令
CMD ["uv", "run", "-m", "src.main"]
