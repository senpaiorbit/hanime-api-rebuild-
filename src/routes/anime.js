// ─── GET /api/anime ───────────────────────────────────────────────────────────
// Query params:
//   id   {string}  Anime slug-id, e.g. "bleach-yaa9n" (required)
//   raw  {string}  If "1", return raw HTML of the anime page instead of JSON

import { Hono } from "hono";
import { scrapeAnimeInfo } from "../util/scraper.js";
import { okPayload, errPayload, cacheControl, fetchRawHTML } from "../util/helper.js";
import { cacheGet, cacheSet } from "../util/redis.js";
import { URLS } from "../config/baseurl.js";
import { CONFIG } from "../config/config.js";
import { logger } from "../util/logger.js";

export const animeRouter = new Hono();

animeRouter.get("/", async (c) => {
  const id = c.req.query("id")?.trim();
  if (!id) return c.json(errPayload("Missing required query param: id"), 400);

  // ── ?raw=1 ──────────────────────────────────────────────────────────────────
  if (c.req.query("raw") === "1") {
    try {
      const cacheKey = `raw:anime:${id}`;
      const cached = await cacheGet(cacheKey);
      if (cached) {
        return c.html(cached, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.RAW_HTML) });
      }
      const html = await fetchRawHTML(URLS.animeInfo(id));
      await cacheSet(cacheKey, html, CONFIG.CACHE.RAW_HTML);
      return c.html(html, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.RAW_HTML) });
    } catch (err) {
      logger.error({ err, id }, "[/api/anime?raw=1]");
      return c.json(errPayload(err.message || "Failed to fetch raw HTML"), 500);
    }
  }

  // ── Normal JSON ─────────────────────────────────────────────────────────────
  const cacheKey = `api:anime:${id}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return c.json(JSON.parse(cached), 200, {
        "Cache-Control": cacheControl(CONFIG.CACHE.ANIME_INFO),
      });
    }
    const data    = await scrapeAnimeInfo(id);
    const payload = okPayload(data);
    await cacheSet(cacheKey, JSON.stringify(payload), CONFIG.CACHE.ANIME_INFO);
    return c.json(payload, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.ANIME_INFO) });
  } catch (err) {
    logger.error({ err, id }, "[/api/anime]");
    return c.json(errPayload(err.message || "Failed to fetch anime info"), 500);
  }
});
