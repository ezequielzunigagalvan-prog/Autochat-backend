import { Router } from "express";
import { isOpenAIConfigured } from "./openaiService.js";

export const aiRouter = Router();

aiRouter.get("/status", (_req, res) => {
  res.json({
    configured: isOpenAIConfigured(),
    model: process.env.OPENAI_MODEL || "gpt-5-mini"
  });
});
