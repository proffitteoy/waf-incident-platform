#!/usr/bin/env python3
"""Forensics async worker using PostgreSQL polling (Plan A)."""

from __future__ import annotations

import hashlib
import os
import pathlib
import time
from datetime import datetime
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

from capture import capture


def get_env(name: str, default: str) -> str:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value


DB_DSN = (
    f"host={get_env('POSTGRES_HOST', 'postgres')} "
    f"port={get_env('POSTGRES_PORT', '5432')} "
    f"dbname={get_env('POSTGRES_DB', 'waf_incident')} "
    f"user={get_env('POSTGRES_USER', 'waf_user')} "
    f"password={get_env('POSTGRES_PASSWORD', 'waf_password')}"
)

POLL_INTERVAL_SEC = max(1, int(get_env("FORENSICS_POLL_INTERVAL_SEC", "2")))
CAPTURE_INTERFACE = get_env("FORENSICS_CAPTURE_INTERFACE", "any")
WORKER_ACTOR = get_env("FORENSICS_WORKER_ACTOR", "forensics-worker")


def resolve_output_path(pcap_uri: str) -> pathlib.Path:
    path = pathlib.Path(pcap_uri)
    if path.is_absolute():
        return path
    return (pathlib.Path.cwd() / path).resolve()


def file_sha256(file_path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def claim_job(conn: psycopg.Connection[Any]) -> dict[str, Any] | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            WITH claim AS (
              SELECT id
              FROM forensics
              WHERE status = 'queued'
              ORDER BY created_at ASC
              LIMIT 1
              FOR UPDATE SKIP LOCKED
            )
            UPDATE forensics f
            SET status = 'capturing',
                error_message = NULL
            FROM claim
            WHERE f.id = claim.id
            RETURNING f.id, f.incident_id, f.ts_start, f.ts_end, f.filter, f.pcap_uri
            """
        )
        return cur.fetchone()


def write_audit(
    conn: psycopg.Connection[Any],
    action: str,
    target_type: str,
    target_id: str,
    detail: dict[str, Any],
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
            VALUES (%s, %s, %s, %s, %s::jsonb)
            """,
            (WORKER_ACTOR, action, target_type, target_id, Json(detail)),
        )


def mark_completed(conn: psycopg.Connection[Any], job_id: str, sha256: str, size_bytes: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE forensics
            SET status = 'completed',
                sha256 = %s,
                size_bytes = %s,
                completed_at = NOW(),
                error_message = NULL
            WHERE id = %s
            """,
            (sha256, size_bytes, job_id),
        )


def mark_failed(conn: psycopg.Connection[Any], job_id: str, message: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE forensics
            SET status = 'failed',
                error_message = %s,
                completed_at = NOW()
            WHERE id = %s
            """,
            (message[:1000], job_id),
        )


def run_once(conn: psycopg.Connection[Any]) -> bool:
    with conn.transaction():
        job = claim_job(conn)

    if job is None:
        return False

    job_id = str(job["id"])
    incident_id = str(job["incident_id"])
    output_path = resolve_output_path(str(job["pcap_uri"]))

    with conn.transaction():
        write_audit(
            conn,
            "forensics_capture_started",
            "forensics",
            job_id,
            {
                "incident_id": incident_id,
                "pcap_uri": str(job["pcap_uri"]),
                "interface": CAPTURE_INTERFACE,
            },
        )

    ts_start = job["ts_start"]
    ts_end = job["ts_end"]
    duration = max(1, int((ts_end - ts_start).total_seconds()))

    try:
        exit_code = capture(CAPTURE_INTERFACE, duration, output_path, job.get("filter"))
        if exit_code != 0:
            raise RuntimeError(f"tshark exited with code {exit_code}")

        if not output_path.exists():
            raise RuntimeError(f"pcap file not found: {output_path}")

        size_bytes = output_path.stat().st_size
        sha256 = file_sha256(output_path)

        with conn.transaction():
            mark_completed(conn, job_id, sha256, size_bytes)
            write_audit(
                conn,
                "forensics_capture_completed",
                "forensics",
                job_id,
                {
                    "incident_id": incident_id,
                    "size_bytes": size_bytes,
                    "sha256": sha256,
                    "completed_at": datetime.utcnow().isoformat() + "Z",
                },
            )
    except Exception as error:  # noqa: BLE001
        with conn.transaction():
            mark_failed(conn, job_id, str(error))
            write_audit(
                conn,
                "forensics_capture_failed",
                "forensics",
                job_id,
                {
                    "incident_id": incident_id,
                    "error": str(error),
                },
            )

    return True


def main() -> int:
    with psycopg.connect(DB_DSN, autocommit=False) as conn:
        while True:
            has_job = run_once(conn)
            if not has_job:
                time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    raise SystemExit(main())
