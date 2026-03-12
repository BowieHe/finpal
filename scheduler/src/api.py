"""HTTP API 服务 - 用于手动触发和健康检查"""

import logging
import threading
from datetime import datetime

from flask import Flask, jsonify

from src.config import config
from src.cron import sync_job
from src.database import Database

logger = logging.getLogger(__name__)

# 创建 Flask 应用
app = Flask(__name__)

# 全局状态
last_sync_time = None
sync_in_progress = False


@app.route("/")
def index():
    """首页"""
    return jsonify({
        "service": "FinPal Scheduler",
        "version": "0.1.0",
        "endpoints": {
            "/health": "健康检查",
            "/trigger": "手动触发同步",
            "/stats": "数据库统计",
        }
    })


@app.route("/health")
def health():
    """健康检查"""
    return jsonify({
        "status": "ok",
        "last_sync": last_sync_time.isoformat() if last_sync_time else None,
        "sync_in_progress": sync_in_progress,
    })


@app.route("/trigger", methods=["POST"])
def trigger():
    """手动触发全量增量更新"""
    global sync_in_progress
    
    if sync_in_progress:
        return jsonify({"status": "error", "message": "同步任务正在进行中"}), 429
    
    thread = threading.Thread(target=sync_job)
    thread.start()
    
    return jsonify({"status": "ok", "message": "全量增量同步任务已启动"})


@app.route("/sync_one", methods=["POST"])
def sync_one():
    """触发单只基金及其关联基金的同步"""
    from flask import request
    data = request.json
    code = data.get("fund_code")
    
    if not code:
        return jsonify({"status": "error", "message": "缺少 fund_code"}), 400

    def run_sync():
        db = Database()
        from src.fetcher import sync_fund_with_enrichment
        try:
            sync_fund_with_enrichment(db, code)
        except Exception as e:
            logger.error(f"异步同步失败 {code}: {e}")

    # 异步执行，不阻塞返回
    thread = threading.Thread(target=run_sync)
    thread.start()

    return jsonify({"status": "ok", "message": f"基金 {code} 同步任务已在后台启动"})


@app.route("/stats")
def stats():
    """获取数据库统计"""
    try:
        db = Database()
        data = db.get_stats()
        return jsonify({
            "status": "ok",
            "data": data
        })
    except Exception as e:
        logger.error(f"获取统计失败: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


def run_api():
    """运行 API 服务"""
    logger.info(f"🌐 启动 HTTP 服务: {config.http_host}:{config.http_port}")
    app.run(
        host=config.http_host,
        port=config.http_port,
        debug=False,
        use_reloader=False  # 避免与后台线程冲突
    )
