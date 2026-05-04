// ─── GET /api/genre ───────────────────────────────────────────────────────────

import { Hono } from "hono";
import { scrapeGenre } from "../util/scraper.js";
import { okPayload, errPayload, cacheControl, intParam, fetchRawHTML } from "../util/helper.js";
import { cacheGet, cacheSet } from "../util/redis.js";
import { URLS } from "../config/baseurl.js";
import { CONFIG } from "../config/config.js";
import { logger } from "../util/logger.js";

export const genreRouter = new Hono();

genreRouter.get("/", async (c) => {
  const name = c.req.query("name")?.trim().toLowerCase();
  const page = intParam(c.req.query("page"), 1);
  if (!name) return c.json(errPayload("Missing required query param: name"), 400);

  if (c.req.query("raw") === "1") {
    try {
      const html = await fetchRawHTML(URLS.genre(name, page));
      return c.html(html, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.RAW_HTML) });
    } catch (err) {
      logger.error({ err, name }, "[/api/genre?raw=1]");
      return c.json(errPayload(err.message || "Failed to fetch raw HTML"), 500);
    }
  }

  const cacheKey = `api:genre:${name}:${page}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return c.json(JSON.parse(cached), 200, { "Cache-Control": cacheControl(CONFIG.CACHE.GENRE) });
    const data    = await scrapeGenre(name, page);
    const payload = okPayload(data);
    await cacheSet(cacheKey, JSON.stringify(payload), CONFIG.CACHE.GENRE);
    return c.json(payload, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.GENRE) });
  } catch (err) {
    logger.error({ err, name }, "[/api/genre]");
    return c.json(errPayload(err.message || "Failed to fetch genre page"), 500);
  }
});
