// ─── GET /api/azlist ──────────────────────────────────────────────────────────

import { Hono } from "hono";
import { scrapeAZList } from "../util/scraper.js";
import { okPayload, errPayload, cacheControl, intParam, fetchRawHTML } from "../util/helper.js";
import { cacheGet, cacheSet } from "../util/redis.js";
import { URLS } from "../config/baseurl.js";
import { CONFIG } from "../config/config.js";
import { logger } from "../util/logger.js";

export const azlistRouter = new Hono();

azlistRouter.get("/", async (c) => {
  const sort = c.req.query("sort")?.trim().toLowerCase() || "all";
  const page = intParam(c.req.query("page"), 1);

  if (!CONFIG.AZ_SORT_OPTIONS.includes(sort)) {
    return c.json(errPayload(`Invalid sort option. Valid: ${CONFIG.AZ_SORT_OPTIONS.join(", ")}`), 400);
  }

  if (c.req.query("raw") === "1") {
    try {
      const html = await fetchRawHTML(URLS.azList(sort, page));
      return c.html(html, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.RAW_HTML) });
    } catch (err) {
      logger.error({ err, sort }, "[/api/azlist?raw=1]");
      return c.json(errPayload(err.message || "Failed to fetch raw HTML"), 500);
    }
  }

  const cacheKey = `api:azlist:${sort}:${page}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return c.json(JSON.parse(cached), 200, { "Cache-Control": cacheControl(CONFIG.CACHE.AZ_LIST) });
    const data    = await scrapeAZList(sort, page);
    const payload = okPayload(data);
    await cacheSet(cacheKey, JSON.stringify(payload), CONFIG.CACHE.AZ_LIST);
    return c.json(payload, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.AZ_LIST) });
  } catch (err) {
    logger.error({ err, sort }, "[/api/azlist]");
    return c.json(errPayload(err.message || "Failed to fetch AZ list"), 500);
  }
});
