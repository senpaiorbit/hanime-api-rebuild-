// ─── GET /api/episodes ────────────────────────────────────────────────────────
// Query params:
//   id   {string}  Anime slug-id (required)
//   raw  {string}  If "1", return raw HTML of the watch page

import { Hono } from "hono";
import { scrapeEpisodes, scrapeAnimeNumericId } from "../util/scraper.js";
import { okPayload, errPayload, cacheControl, fetchRawHTML } from "../util/helper.js";
import { cacheGet, cacheSet } from "../util/redis.js";
import { URLS } from "../config/baseurl.js";
import { CONFIG } from "../config/config.js";
import { logger } from "../util/logger.js";

export const episodesRouter = new Hono();

episodesRouter.get("/", async (c) => {
  const id = c.req.query("id")?.trim();
  if (!id) return c.json(errPayload("Missing required param: id (anime slug)"), 400);

  // ── ?raw=1 ──────────────────────────────────────────────────────────────────
  if (c.req.query("raw") === "1") {
    try {
      const cacheKey = `raw:watch:${id}`;
      const cached   = await cacheGet(cacheKey);
      if (cached) {
        return c.html(cached, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.RAW_HTML) });
      }
      const html = await fetchRawHTML(URLS.animeWatch(id));
      await cacheSet(cacheKey, html, CONFIG.CACHE.RAW_HTML);
      return c.html(html, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.RAW_HTML) });
    } catch (err) {
      logger.error({ err, id }, "[/api/episodes?raw=1]");
      return c.json(errPayload(err.message || "Failed to fetch raw HTML"), 500);
    }
  }

  // ── Normal JSON ─────────────────────────────────────────────────────────────
  const cacheKey = `api:episodes:${id}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return c.json(JSON.parse(cached), 200, {
        "Cache-Control": cacheControl(CONFIG.CACHE.EPISODES),
      });
    }
    const numericId = await scrapeAnimeNumericId(id);
    const data      = await scrapeEpisodes(numericId);
    const payload   = okPayload(data);
    await cacheSet(cacheKey, JSON.stringify(payload), CONFIG.CACHE.EPISODES);
    return c.json(payload, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.EPISODES) });
  } catch (err) {
    logger.error({ err, id }, "[/api/episodes]");
    return c.json(errPayload(err.message || "Failed to fetch episodes"), 500);
  }
});
