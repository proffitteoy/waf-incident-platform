#!/usr/bin/env python3
"""Minimal tshark capture helper skeleton."""

from __future__ import annotations

import argparse
import datetime as dt
import pathlib
import subprocess
import hashlib


def capture(interface: str, duration_sec: int, output_file: pathlib.Path, bpf_filter: str | None) -> int:
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


def calculate_sha256(file_path: pathlib.Path) -> str:
    """计算文件 sha256 签名"""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def update_forensics_record(forensics_id: str, pcap_path: str, sha256: str, size_bytes: int) -> bool:
    """更新 forensics 表记录，将状态改为 completed"""
    import psycopg2
    import os
    
    # 从环境变量读取数据库连接信息
    db_url = os.environ.get("POSTGRES_URL", "postgresql://waf_user:waf_password@localhost:5432/waf_incident")
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        cur.execute(
            """
            UPDATE forensics 
            SET status = 'completed', 
                pcap_path = %s, 
                sha256 = %s, 
                size_bytes = %s, 
                completed_at = NOW()
            WHERE id = %s
            """,
            (pcap_path, sha256, size_bytes, forensics_id)
        )
        
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Failed to update forensics record: {e}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Capture pcap using tshark")
    parser.add_argument("--interface", default="any")
    parser.add_argument("--duration", type=int, default=60)
    parser.add_argument("--filter", default=None)
    parser.add_argument("--output-dir", default="../../storage/pcap")
    parser.add_argument("--forensics-id", default=None, help="取证记录 ID，用于回写数据库")
    args = parser.parse_args()

    ts = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    path = pathlib.Path(args.output_dir) / f"capture-{ts}.pcap"
    result = capture(args.interface, args.duration, path, args.filter)
    
    if result == 0:
        # 计算并输出签名
        signature = calculate_sha256(path)
        size_bytes = path.stat().st_size
        
        print(f"Captured: {path}")
        print(f"Size: {size_bytes} bytes")
        print(f"SHA256: {signature}")
        
        # 如果提供了 forensics_id，回写数据库
        if args.forensics_id:
            success = update_forensics_record(args.forensics_id, str(path), signature, size_bytes)
            if success:
                print(f"Updated forensics record: {args.forensics_id}")
            else:
                print(f"Failed to update forensics record: {args.forensics_id}")
                return 1
    else:
        # 抓包失败，更新状态为 failed
        if args.forensics_id:
            update_forensics_failed(args.forensics_id, f"tshark exited with code {result}")
        return result
    
    return result


def update_forensics_failed(forensics_id: str, error_message: str) -> bool:
    """更新 forensics 表记录，将状态改为 failed"""
    import psycopg2
    import os
    
    db_url = os.environ.get("POSTGRES_URL", "postgresql://waf_user:waf_password@localhost:5432/waf_incident")
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        cur.execute(
            """
            UPDATE forensics 
            SET status = 'failed', 
                error_message = %s, 
                completed_at = NOW()
            WHERE id = %s
            """,
            (error_message, forensics_id)
        )
        
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Failed to update forensics record as failed: {e}")
        return False


if __name__ == "__main__":
    raise SystemExit(main())