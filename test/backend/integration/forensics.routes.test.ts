import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createTestApp } from "../backend-test-utils";

describe("forensics routes", () => {
  test("returns 409 when download is requested before capture is completed", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forensics-test-"));
    const context = await createTestApp({
      surface: "forensics",
      envOverrides: {
        PCAP_DIR: tmpRoot,
        FORENSICS_DOWNLOAD_TOKEN_REQUIRED: "false"
      }
    });

    try {
      const incident = await context.seedIncident();
      const task = await context.query<{ id: string }>(
        `INSERT INTO forensics (incident_id, ts_start, ts_end, filter, pcap_uri, status)
         VALUES ($1, $2, $3, $4, $5, 'queued')
         RETURNING id::text`,
        [
          incident.id,
          "2026-03-04T00:00:00.000Z",
          "2026-03-04T00:05:00.000Z",
          "ip host 203.0.113.10",
          path.join(tmpRoot, "queued.pcap")
        ]
      );

      const response = await request(context.app).get(`/api/forensics/${task.rows[0].id}/download`);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("pcap not ready");
    } finally {
      await context.close();
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test("returns signed download url and streams completed pcap", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forensics-test-"));
    const pcapPath = path.join(tmpRoot, "incident-completed.pcap");
    fs.writeFileSync(pcapPath, Buffer.from([1, 2, 3, 4]));

    const context = await createTestApp({
      surface: "forensics",
      envOverrides: {
        PCAP_DIR: tmpRoot,
        FORENSICS_DOWNLOAD_TOKEN_REQUIRED: "true",
        FORENSICS_DOWNLOAD_SIGNING_SECRET: "integration-test-signing-secret",
        FORENSICS_DOWNLOAD_URL_TTL_SECONDS: "300"
      }
    });

    try {
      const incident = await context.seedIncident();
      const task = await context.query<{ id: string }>(
        `INSERT INTO forensics (incident_id, ts_start, ts_end, filter, pcap_uri, status, sha256, size_bytes, completed_at)
         VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, $8)
         RETURNING id::text`,
        [
          incident.id,
          "2026-03-04T00:00:00.000Z",
          "2026-03-04T00:05:00.000Z",
          "ip host 203.0.113.10",
          pcapPath,
          "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a",
          4,
          "2026-03-04T00:06:00.000Z"
        ]
      );

      const metaResponse = await request(context.app).get(`/api/forensics/${task.rows[0].id}`);
      expect(metaResponse.status).toBe(200);
      expect(metaResponse.body.download_url).toContain(`/api/forensics/${task.rows[0].id}/download?token=`);
      expect(metaResponse.body.expires_at).toBeTruthy();

      const downloadPath = String(metaResponse.body.download_url);
      const downloadResponse = await request(context.app).get(downloadPath);

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers["content-type"]).toContain("application/vnd.tcpdump.pcap");
      expect(downloadResponse.headers["x-pcap-sha256"]).toBe(
        "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a"
      );
    } finally {
      await context.close();
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
