// ─── GET /api/home ────────────────────────────────────────────────────────────

import { Hono } from "hono";
import { scrapeHome } from "../util/scraper.js";
import { okPayload, errPayload, cacheControl } from "../util/helper.js";
import { cacheGet, cacheSet } from "../util/redis.js";
import { fetchRawHTML } from "../util/helper.js";
import { URLS } from "../config/baseurl.js";
import { CONFIG } from "../config/config.js";
import { logger } from "../util/logger.js";

export const homeRouter = new Hono();

homeRouter.get("/", async (c) => {
  // ── ?raw=1 — return the raw HTML of the hianime home page ──────────────────
  if (c.req.query("raw") === "1") {
    try {
      const cached = await cacheGet("raw:home");
      if (cached) {
        logger.debug("raw:home cache hit");
        return c.html(cached, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.RAW_HTML) });
      }
      const html = await fetchRawHTML(URLS.home());
      await cacheSet("raw:home", html, CONFIG.CACHE.RAW_HTML);
      return c.html(html, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.RAW_HTML) });
    } catch (err) {
      logger.error({ err }, "[/api/home?raw=1]");
      return c.json(errPayload(err.message || "Failed to fetch raw HTML"), 500);
    }
  }

  // ── Normal JSON response ────────────────────────────────────────────────────
  const cacheKey = "api:home";
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      logger.debug("cache hit: api:home");
      return c.json(JSON.parse(cached), 200, {
        "Cache-Control": cacheControl(CONFIG.CACHE.HOME),
      });
    }

    const raw = await scrapeHome();

    const data = {
      genres: raw.genres,
      spotlightAnimes: raw.spotlightAnimes.map((a) => ({
        id: a.id, name: a.name, jname: a.jname, poster: a.poster,
        description: a.description, rank: a.rank, otherInfo: a.otherInfo,
        episodes: { sub: a.episodes.sub, dub: a.episodes.dub },
      })),
      trendingAnimes: raw.trendingAnimes.map((a) => ({
        id: a.id, name: a.name, poster: a.poster, rank: a.rank,
      })),
      latestEpisodeAnimes: raw.latestEpisodeAnimes.map((a) => ({
        id: a.id, name: a.name, poster: a.poster, type: a.type,
        episodes: { sub: a.episodes.sub, dub: a.episodes.dub },
      })),
      topUpcomingAnimes: raw.topUpcomingAnimes.map((a) => ({
        id: a.id, name: a.name, poster: a.poster, duration: a.duration,
        type: a.type, rating: a.rating,
        episodes: { sub: a.episodes.sub, dub: a.episodes.dub },
      })),
      top10Animes: {
        today: raw.top10Animes.today.map((a) => ({
          id: a.id, name: a.name, poster: a.poster, rank: a.rank,
          episodes: { sub: a.episodes.sub, dub: a.episodes.dub },
        })),
        week: raw.top10Animes.week.map((a) => ({
          id: a.id, name: a.name, poster: a.poster, rank: a.rank,
          episodes: { sub: a.episodes.sub, dub: a.episodes.dub },
        })),
        month: raw.top10Animes.month.map((a) => ({
          id: a.id, name: a.name, poster: a.poster, rank: a.rank,
          episodes: { sub: a.episodes.sub, dub: a.episodes.dub },
        })),
      },
      mostPopularAnimes: raw.mostPopularAnimes.map((a) => ({
        id: a.id, name: a.name, poster: a.poster, type: a.type,
        episodes: { sub: a.episodes.sub, dub: a.episodes.dub },
      })),
      mostFavoriteAnimes: raw.mostFavoriteAnimes.map((a) => ({
        id: a.id, name: a.name, poster: a.poster, type: a.type,
        episodes: { sub: a.episodes.sub, dub: a.episodes.dub },
      })),
      topAiringAnimes: raw.topAiringAnimes.map((a) => ({
        id: a.id, name: a.name, jname: a.jname, poster: a.poster,
      })),
      latestCompletedAnimes: raw.latestCompletedAnimes.map((a) => ({
        id: a.id, name: a.name, poster: a.poster, type: a.type,
        episodes: { sub: a.episodes.sub, dub: a.episodes.dub },
      })),
    };

    const payload = okPayload(data);
    await cacheSet(cacheKey, JSON.stringify(payload), CONFIG.CACHE.HOME);
    return c.json(payload, 200, { "Cache-Control": cacheControl(CONFIG.CACHE.HOME) });
  } catch (err) {
    logger.error({ err }, "[/api/home]");
    return c.json(errPayload(err.message || "Failed to scrape home page"), 500);
  }
});
