FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

# 启用 uv 的编译缓存
ENV UV_COMPILE_BYTECODE=1

# 从缓存层复制（如果可用）
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project --no-dev

# 复制项目代码
ADD . /app

# 安装项目
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# 添加到 PATH
ENV PATH="/app/.venv/bin:$PATH"

# 暴露 HTTP 端口
EXPOSE 8000

# 使用 uv 运行
CMD ["uv", "run", "-m", "src.main"]
