import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler";
import { getLlmSettings, updateLlmSettings } from "../../services/llm/llm-settings.service";

export const settingsRouter = Router();

settingsRouter.get(
  "/llm",
  asyncHandler(async (_req, res) => {
    const llm = await getLlmSettings();
    res.json({ llm });
  })
);

settingsRouter.put(
  "/llm",
  asyncHandler(async (req, res) => {
    const llm = await updateLlmSettings(req.body);
    res.json({ llm });
  })
);
