// ─── GET /api/category ────────────────────────────────────────────────────────

import { Hono } from "hono";
import { scrapeCategory } from "../util/scraper.js";
import { okPayload, errPayload, cacheControl, intParam, fetchRawHTML } from "../util/helper.js";
import { cacheGet, cacheSet } from "../util/redis.js";
import { URLS } from "../config/baseurl.js";
import { CONFIG } from "../config/config.js";
import { logger } from "../util/logger.js";

export const categoryRouter = new Hono();

categoryRouter.get("/", async (c) => {
  const name = c.req.query("name")?.trim().toLowerCase();
  const page = intParam(c.req.query("page"), 1);
  if (!name) return c.json(errPayload("Missing required query param: name"), 400);
  if (!CONFIG.CATEGORIES.includes(name)) {
    return c.json(errPayload(`Invalid category. Valid: ${CONFIG.CATEGORIES.join(", ")}`), 400);
  }

  if (c.req.query("raw") === "1") {
    try {
      const html = await fetchRawHTML(URLS.category(name, page));
      return c.html(html, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.RAW_HTML) });
    } catch (err) {
      logger.error({ err, name }, "[/api/category?raw=1]");
      return c.json(errPayload(err.message || "Failed to fetch raw HTML"), 500);
    }
  }

  const cacheKey = `api:category:${name}:${page}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return c.json(JSON.parse(cached), 200, { "Cache-Control": cacheControl(CONFIG.CACHE.CATEGORY) });
    const data    = await scrapeCategory(name, page);
    const payload = okPayload(data);
    await cacheSet(cacheKey, JSON.stringify(payload), CONFIG.CACHE.CATEGORY);
    return c.json(payload, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.CATEGORY) });
  } catch (err) {
    logger.error({ err, name }, "[/api/category]");
    return c.json(errPayload(err.message || "Failed to fetch category"), 500);
  }
});
