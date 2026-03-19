#!/usr/bin/env python3
"""Enhanced tshark capture helper with database status callback."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import os
import pathlib
import subprocess
import sys
import json
import urllib.request
import urllib.error


def calculate_sha256(file_path: pathlib.Path) -> str:
    """Calculate SHA256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def capture(interface: str, duration_sec: int, output_file: pathlib.Path, bpf_filter: str | None) -> int:
    """Execute tshark capture command."""
    output_file.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "tshark",
        "-i",
        interface,
        "-a",
        f"duration:{duration_sec}",
        "-w",
        str(output_file),
    ]
    if bpf_filter:
        cmd.extend(["-f", bpf_filter])
    return subprocess.call(cmd)


def update_forensics_status(
    task_id: str,
    status: str,
    sha256: str | None = None,
    size_bytes: int | None = None,
    error_message: str | None = None,
    backend_url: str | None = None
) -> None:
    """
    Update forensics task status in database via HTTP callback.
    
    生产环境实现：通过 HTTP 回调更新后端数据库状态
    """
    # 从环境变量读取后端地址
    api_base = backend_url or os.environ.get('BACKEND_API_URL', 'http://localhost:3000')
    callback_url = f"{api_base}/api/forensics/{task_id}/status"
    
    payload = {
        "status": status,
        "updated_at": dt.datetime.utcnow().isoformat() + "Z"
    }
    
    if sha256:
        payload["sha256"] = sha256
    if size_bytes is not None:
        payload["size_bytes"] = size_bytes
    if error_message:
        payload["error_message"] = error_message
    
    try:
        req = urllib.request.Request(
            callback_url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='PATCH'
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            print(f"[callback] status={status} http_status={response.status}")
    except urllib.error.URLError as e:
        # 回调失败时降级为日志输出
        print(f"[callback] task={task_id} status={status} sha256={sha256} size={size_bytes} (HTTP callback failed: {e})")


def main() -> int:
    parser = argparse.ArgumentParser(description="Capture pcap using tshark")
    parser.add_argument("--interface", default="any")
    parser.add_argument("--duration", type=int, default=60)
    parser.add_argument("--filter", default=None)
    parser.add_argument("--output-dir", default="../../storage/pcap")
    parser.add_argument("--task-id", default=None, help="Forensics task ID for status callback")
    parser.add_argument("--incident-id", default=None, help="Incident ID for audit logging")
    parser.add_argument("--backend-url", default=None, help="Backend API base URL for callback")
    args = parser.parse_args()

    ts = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    output_path = pathlib.Path(args.output_dir) / f"capture-{ts}.pcap"
    
    # 如果有 task-id，先更新状态为 processing
    if args.task_id:
        update_forensics_status(args.task_id, "processing", backend_url=args.backend_url)

    return_code = capture(args.interface, args.duration, output_path, args.filter)
    
    if return_code == 0 and output_path.exists():
        sha256 = calculate_sha256(output_path)
        size_bytes = output_path.stat().st_size
        
        # 更新状态为 completed
        if args.task_id:
            update_forensics_status(
                args.task_id, 
                "completed", 
                sha256=sha256, 
                size_bytes=size_bytes,
                backend_url=args.backend_url
            )
        
        # 输出结果供调用方解析
        print(f"CAPTURE_COMPLETE|{output_path}|{sha256}|{size_bytes}")
        return 0
    else:
        if args.task_id:
            update_forensics_status(
                args.task_id, 
                "failed", 
                error_message=f"tshark exit code {return_code}",
                backend_url=args.backend_url
            )
        return return_code


if __name__ == "__main__":
    raise SystemExit(main())