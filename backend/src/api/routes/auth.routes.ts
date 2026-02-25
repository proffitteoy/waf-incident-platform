import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { HttpError } from "../../core/http/http-error";
import { query } from "../../core/db/pool";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const authRouter = Router();

authRouter.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);

    const result = await query<{ id: string; username: string; role: string }>(
      "SELECT id, username, role FROM users WHERE username = $1 LIMIT 1",
      [input.username]
    );

    if (result.rowCount === 0) {
      throw new HttpError(401, "invalid credentials");
    }

    const user = result.rows[0];
    const token = Buffer.from(`${user.id}:${user.role}`).toString("base64");

    res.json({ token, user });
  })
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const username = (req.header("x-user") ?? "admin").trim();
    const result = await query<{ id: string; username: string; role: string }>(
      "SELECT id, username, role FROM users WHERE username = $1 LIMIT 1",
      [username]
    );

    if (result.rowCount === 0) {
      throw new HttpError(404, "user not found");
    }

    res.json(result.rows[0]);
  })
);
