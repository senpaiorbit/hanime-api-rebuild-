// ─── GET /api/search ──────────────────────────────────────────────────────────
// Query params:
//   q        {string}  Search keyword (required)
//   page     {number}  Page number (default: 1)
//   raw      {string}  If "1", return raw HTML of search results page
//   type, status, rated, score, season, language, start_date, end_date, sort, genres

import { Hono } from "hono";
import { scrapeSearch } from "../util/scraper.js";
import { okPayload, errPayload, cacheControl, intParam, fetchRawHTML } from "../util/helper.js";
import { cacheGet, cacheSet } from "../util/redis.js";
import { URLS } from "../config/baseurl.js";
import { CONFIG } from "../config/config.js";
import { logger } from "../util/logger.js";

export const searchRouter = new Hono();

searchRouter.get("/", async (c) => {
  const q    = c.req.query("q")?.trim();
  const page = intParam(c.req.query("page"), 1);
  if (!q) return c.json(errPayload("Missing required query param: q"), 400);

  // ── ?raw=1 ──────────────────────────────────────────────────────────────────
  if (c.req.query("raw") === "1") {
    try {
      const html = await fetchRawHTML(URLS.search(q, page));
      return c.html(html, 200, { "Cache-Control": "no-store" });
    } catch (err) {
      logger.error({ err, q }, "[/api/search?raw=1]");
      return c.json(errPayload(err.message || "Failed to fetch raw HTML"), 500);
    }
  }

  // ── Normal JSON ─────────────────────────────────────────────────────────────
  const filterKeys = ["type","status","rated","score","season","language","start_date","end_date","sort","genres"];
  const filters    = {};
  for (const k of filterKeys) {
    const v = c.req.query(k);
    if (v) filters[k] = v;
  }

  const cacheKey = `api:search:${q}:${page}:${JSON.stringify(filters)}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return c.json(JSON.parse(cached), 200, {
        "Cache-Control": cacheControl(CONFIG.CACHE.SEARCH),
      });
    }
    const data    = await scrapeSearch(q, page, filters);
    const payload = okPayload(data);
    await cacheSet(cacheKey, JSON.stringify(payload), CONFIG.CACHE.SEARCH);
    return c.json(payload, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.SEARCH) });
  } catch (err) {
    logger.error({ err, q }, "[/api/search]");
    return c.json(errPayload(err.message || "Search failed"), 500);
  }
});
