import { Router } from "express";
import { forensicsRouter } from "./routes/forensics.routes";

export const apiRouter = Router();

// 挂载取证路由
apiRouter.use("/forensics", forensicsRouter);

// 健康检查
apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "signature-forensics-backend" });
});