#!/usr/bin/env python3
"""Capture pcap using tshark and optionally callback backend status."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import pathlib
import subprocess
import urllib.error
import urllib.request


def calculate_sha256(file_path: pathlib.Path) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


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


def update_forensics_status(
    task_id: str,
    status: str,
    sha256: str | None = None,
    size_bytes: int | None = None,
    error_message: str | None = None,
    backend_url: str | None = None,
) -> None:
    api_base = backend_url or os.environ.get("BACKEND_API_URL", "http://localhost:3000")
    callback_url = f"{api_base}/api/forensics/{task_id}/status"

    payload = {"status": status}
    if sha256:
        payload["sha256"] = sha256
    if size_bytes is not None:
        payload["size_bytes"] = size_bytes
    if error_message:
        payload["error_message"] = error_message

    try:
        request = urllib.request.Request(
            callback_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="PATCH",
        )
        with urllib.request.urlopen(request, timeout=10):
            return
    except urllib.error.URLError:
        # Callback failures are logged by caller side; worker still exits with capture result.
        return


def main() -> int:
    parser = argparse.ArgumentParser(description="Capture pcap using tshark")
    parser.add_argument("--interface", default="any")
    parser.add_argument("--duration", type=int, default=60)
    parser.add_argument("--filter", default=None)
    parser.add_argument("--output-dir", default="../../storage/pcap")
    parser.add_argument("--output-file", default=None)
    parser.add_argument("--task-id", default=None)
    parser.add_argument("--incident-id", default=None)
    parser.add_argument("--backend-url", default=None)
    args = parser.parse_args()

    file_name = args.output_file
    if not file_name:
        ts = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        file_name = f"capture-{ts}.pcap"

    output_path = pathlib.Path(args.output_dir) / file_name

    if args.task_id:
        update_forensics_status(args.task_id, "capturing", backend_url=args.backend_url)

    return_code = capture(args.interface, args.duration, output_path, args.filter)

    if return_code == 0 and output_path.exists():
        sha256 = calculate_sha256(output_path)
        size_bytes = output_path.stat().st_size
        if args.task_id:
            update_forensics_status(
                args.task_id,
                "completed",
                sha256=sha256,
                size_bytes=size_bytes,
                backend_url=args.backend_url,
            )
    elif args.task_id:
        update_forensics_status(
            args.task_id,
            "failed",
            error_message=f"tshark exited with code {return_code}",
            backend_url=args.backend_url,
        )

    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
