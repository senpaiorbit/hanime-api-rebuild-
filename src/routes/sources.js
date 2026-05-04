// ─── GET /api/sources ─────────────────────────────────────────────────────────

import { Hono } from "hono";
import { scrapeEpisodeSources } from "../util/scraper.js";
import { okPayload, errPayload, cacheControl } from "../util/helper.js";
import { cacheGet, cacheSet } from "../util/redis.js";
import { CONFIG } from "../config/config.js";
import { logger } from "../util/logger.js";

export const sourcesRouter = new Hono();

sourcesRouter.get("/", async (c) => {
  const serverId = c.req.query("serverId")?.trim();
  if (!serverId) return c.json(errPayload("Missing required query param: serverId"), 400);

  const cacheKey = `api:sources:${serverId}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return c.json(JSON.parse(cached), 200, { "Cache-Control": cacheControl(CONFIG.CACHE.SOURCES) });
    const data    = await scrapeEpisodeSources(serverId);
    const payload = okPayload(data);
    await cacheSet(cacheKey, JSON.stringify(payload), CONFIG.CACHE.SOURCES);
    return c.json(payload, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.SOURCES) });
  } catch (err) {
    logger.error({ err, serverId }, "[/api/sources]");
    return c.json(errPayload(err.message || "Failed to fetch sources"), 500);
  }
});
