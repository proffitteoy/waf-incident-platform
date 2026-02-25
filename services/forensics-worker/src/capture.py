#!/usr/bin/env python3
"""Minimal tshark capture helper skeleton."""

from __future__ import annotations

import argparse
import datetime as dt
import pathlib
import subprocess


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


def main() -> int:
    parser = argparse.ArgumentParser(description="Capture pcap using tshark")
    parser.add_argument("--interface", default="any")
    parser.add_argument("--duration", type=int, default=60)
    parser.add_argument("--filter", default=None)
    parser.add_argument("--output-dir", default="../../storage/pcap")
    args = parser.parse_args()

    ts = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    path = pathlib.Path(args.output_dir) / f"capture-{ts}.pcap"
    return capture(args.interface, args.duration, path, args.filter)


if __name__ == "__main__":
    raise SystemExit(main())
