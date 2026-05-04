// ─── GET /api/servers ─────────────────────────────────────────────────────────

import { Hono } from "hono";
import { scrapeEpisodeServers } from "../util/scraper.js";
import { okPayload, errPayload, cacheControl } from "../util/helper.js";
import { cacheGet, cacheSet } from "../util/redis.js";
import { CONFIG } from "../config/config.js";
import { logger } from "../util/logger.js";

export const serversRouter = new Hono();

serversRouter.get("/", async (c) => {
  const episodeId = c.req.query("episodeId")?.trim();
  if (!episodeId) return c.json(errPayload("Missing required query param: episodeId"), 400);

  // No ?raw=1 for servers — it's an AJAX JSON endpoint, not a full page
  const cacheKey = `api:servers:${episodeId}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return c.json(JSON.parse(cached), 200, { "Cache-Control": cacheControl(CONFIG.CACHE.SERVERS) });
    const data    = await scrapeEpisodeServers(episodeId);
    const payload = okPayload(data);
    await cacheSet(cacheKey, JSON.stringify(payload), CONFIG.CACHE.SERVERS);
    return c.json(payload, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.SERVERS) });
  } catch (err) {
    logger.error({ err, episodeId }, "[/api/servers]");
    return c.json(errPayload(err.message || "Failed to fetch servers"), 500);
  }
});
