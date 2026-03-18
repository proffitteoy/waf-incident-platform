import { randomUUID } from "crypto";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import request from "supertest";
import { createTestApp } from "../backend-test-utils";

describe("forensics routes", () => {
  const pcapDir = path.resolve(__dirname, "../../../backend/storage/pcap");

  test("creates queued forensics task from capture endpoint", async () => {
    const context = await createTestApp({ surface: "forensics" });

    try {
      const incident = await context.seedIncident();
      const response = await request(context.app)
        .post(`/api/incidents/${incident.id}/forensics/capture`)
        .send({ requested_by: "tester" });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("queued");

      const rows = await context.query<{ status: string }>(
        "SELECT status FROM forensics WHERE id = $1 LIMIT 1",
        [response.body.id]
      );

      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0].status).toBe("queued");
    } finally {
      await context.close();
    }
  });

  test("returns 409 from download endpoint before capture is completed", async () => {
    const context = await createTestApp({ surface: "forensics" });

    try {
      const incident = await context.seedIncident();
      const insert = await context.query<{ id: string }>(
        `INSERT INTO forensics (incident_id, ts_start, ts_end, filter, pcap_uri, status)
         VALUES ($1, NOW() - INTERVAL '5 minute', NOW(), NULL, $2, 'queued')
         RETURNING id::text`,
        [incident.id, "./storage/pcap/not-ready.pcap"]
      );

      const response = await request(context.app).get(`/api/forensics/${insert.rows[0].id}/download`);

      expect(response.status).toBe(409);
      expect(response.body.status).toBe("queued");
    } finally {
      await context.close();
    }
  });

  test("issues signed download url and streams pcap for completed task", async () => {
    const context = await createTestApp({ surface: "forensics" });

    mkdirSync(pcapDir, { recursive: true });
    const fileName = `test-${randomUUID()}.pcap`;
    const filePath = path.resolve(pcapDir, fileName);
    writeFileSync(filePath, Buffer.from("pcap-test-data"));

    try {
      const incident = await context.seedIncident();
      const insert = await context.query<{ id: string }>(
        `INSERT INTO forensics (incident_id, ts_start, ts_end, filter, pcap_uri, status, completed_at)
         VALUES ($1, NOW() - INTERVAL '5 minute', NOW(), NULL, $2, 'completed', NOW())
         RETURNING id::text`,
        [incident.id, filePath]
      );

      const metaResponse = await request(context.app).get(`/api/forensics/${insert.rows[0].id}/download`);
      expect(metaResponse.status).toBe(200);
      expect(metaResponse.body.download_url).toContain(`/api/forensics/${insert.rows[0].id}/file?token=`);
      expect(metaResponse.body.expires_at).toBeTruthy();

      const fileResponse = await request(context.app).get(metaResponse.body.download_url);
      expect(fileResponse.status).toBe(200);
      expect(String(fileResponse.headers["content-type"])).toContain("application/vnd.tcpdump.pcap");
    } finally {
      rmSync(filePath, { force: true });
      await context.close();
    }
  });
});
