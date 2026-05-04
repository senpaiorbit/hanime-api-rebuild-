// ─── GET /api/search-suggestion ───────────────────────────────────────────────

import { Hono } from "hono";
import { scrapeSearchSuggestions } from "../util/scraper.js";
import { okPayload, errPayload, cacheControl } from "../util/helper.js";
import { cacheGet, cacheSet } from "../util/redis.js";
import { CONFIG } from "../config/config.js";
import { logger } from "../util/logger.js";

export const searchSuggestionRouter = new Hono();

searchSuggestionRouter.get("/", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) return c.json(errPayload("Missing required query param: q"), 400);

  const cacheKey = `api:suggest:${q}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return c.json(JSON.parse(cached), 200, { "Cache-Control": cacheControl(CONFIG.CACHE.SEARCH) });
    const data    = await scrapeSearchSuggestions(q);
    const payload = okPayload(data);
    await cacheSet(cacheKey, JSON.stringify(payload), CONFIG.CACHE.SEARCH);
    return c.json(payload, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.SEARCH) });
  } catch (err) {
    logger.error({ err, q }, "[/api/search-suggestion]");
    return c.json(errPayload(err.message || "Suggestion fetch failed"), 500);
  }
});
