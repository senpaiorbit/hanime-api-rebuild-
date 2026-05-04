// ─── GET /api/qtip ────────────────────────────────────────────────────────────

import { Hono } from "hono";
import { scrapeQtip } from "../util/scraper.js";
import { okPayload, errPayload, cacheControl } from "../util/helper.js";
import { cacheGet, cacheSet } from "../util/redis.js";
import { CONFIG } from "../config/config.js";
import { logger } from "../util/logger.js";

export const qtipRouter = new Hono();

qtipRouter.get("/", async (c) => {
  const id = c.req.query("id")?.trim();
  if (!id) return c.json(errPayload("Missing required query param: id"), 400);

  const cacheKey = `api:qtip:${id}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return c.json(JSON.parse(cached), 200, { "Cache-Control": cacheControl(CONFIG.CACHE.ANIME_INFO) });
    const data    = await scrapeQtip(id);
    const payload = okPayload(data);
    await cacheSet(cacheKey, JSON.stringify(payload), CONFIG.CACHE.ANIME_INFO);
    return c.json(payload, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.ANIME_INFO) });
  } catch (err) {
    logger.error({ err, id }, "[/api/qtip]");
    return c.json(errPayload(err.message || "Failed to fetch qtip info"), 500);
  }
});
