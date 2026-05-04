// ─── GET /api/schedule ────────────────────────────────────────────────────────

import { Hono } from "hono";
import { scrapeSchedule } from "../util/scraper.js";
import { okPayload, errPayload, cacheControl, safeDate, fetchRawHTML } from "../util/helper.js";
import { cacheGet, cacheSet } from "../util/redis.js";
import { URLS } from "../config/baseurl.js";
import { CONFIG } from "../config/config.js";
import { logger } from "../util/logger.js";

export const scheduleRouter = new Hono();

scheduleRouter.get("/", async (c) => {
  const date = safeDate(c.req.query("date") || "");

  if (c.req.query("raw") === "1") {
    try {
      const html = await fetchRawHTML(URLS.schedule(date));
      return c.html(html, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.RAW_HTML) });
    } catch (err) {
      logger.error({ err, date }, "[/api/schedule?raw=1]");
      return c.json(errPayload(err.message || "Failed to fetch raw HTML"), 500);
    }
  }

  const cacheKey = `api:schedule:${date}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return c.json(JSON.parse(cached), 200, { "Cache-Control": cacheControl(CONFIG.CACHE.SCHEDULE) });
    const data    = await scrapeSchedule(date);
    const payload = okPayload(data);
    await cacheSet(cacheKey, JSON.stringify(payload), CONFIG.CACHE.SCHEDULE);
    return c.json(payload, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.SCHEDULE) });
  } catch (err) {
    logger.error({ err, date }, "[/api/schedule]");
    return c.json(errPayload(err.message || "Failed to fetch schedule"), 500);
  }
});
