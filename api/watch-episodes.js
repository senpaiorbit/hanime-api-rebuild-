// ─── GET /api/watch-episodes ──────────────────────────────────────────────────
//
// Unified episode scraper for TWO watch-page types:
//
//   TYPE 1  (e.g. anikototv.to / sites without episode list in HTML)
//   ─────────────────────────────────────────────────────────────────
//   The watch page has NO .ssl-item episode list.
//   It shows only a total episode count inside .bmeta or similar.
//   The anilist_id is embedded in the player banner background-image.
//
//   Response shape:
//   {
//     success: true,
//     pageType: "count-only",
//     data: {
//       animeId: "bleach-thousand-year-blood-war-the-conflict-sqamb",
//       siteId: 6632,
//       anilistId: 169755,
//       totalEpisodes: 14,
//       episodes: null
//     }
//   }
//
//   TYPE 2  (e.g. hianime.re / sites with AJAX episode list)
//   ──────────────────────────────────────────────────────────
//   The watch page exposes a numeric data-id used to hit
//   /ajax/v2/episode/list/{siteId} → JSON { html: "…" }.
//   The HTML fragment contains .ssl-item nodes with titles.
//
//   Response shape:
//   {
//     success: true,
//     pageType: "episode-list",
//     data: {
//       animeId: "bleach-yaa9n",
//       siteId: 1057,
//       anilistId: null,
//       totalEpisodes: 366,
//       episodes: [
//         { number: 1, title: "The Day I Became a Shinigami",
//           episodeId: "bleach-yaa9n?ep=1", isFiller: false },
//         ...
//       ]
//     }
//   }
//
// Route (via vercel.json rewrite):
//   GET /api/v2/hianime/:animeId/episodes
//   → GET /api/watch-episodes?id=:animeId
//
// The handler auto-detects the page type by checking whether
// the watch page is served from WATCH_URL (config) or HIANIME_URL.

export const config = { runtime: "edge" };

import * as cheerio from "cheerio";
import { jsonResponse, errorResponse, fetchPage, fetchHTML, clean } from "../util/helper.js";
import { formatEpisode } from "../util/format.js";
import { CONFIG } from "../config/config.js";
import { WATCH_CONFIG } from "../config/watchurl.js";
import { URLS } from "../config/baseurl.js";

export default async function handler(req) {
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();
  if (!id) return errorResponse("Missing required param: id (anime slug)", 400);

  try {
    // ── Step 1: Fetch the watch page (from configured WATCH_URL) ───────────
    const watchUrl = `${WATCH_CONFIG.watchUrl}/watch/${id}`;
    const html     = await fetchPage(watchUrl, CONFIG.REQUEST_HEADERS);
    const $        = cheerio.load(html);

    // ── Step 2: Extract site-internal numeric id ───────────────────────────
    // Works for both anikoto (#watch-main[data-id]) and hianime (#main-wrapper[data-id])
    const siteId =
      parseInt($("#watch-main").attr("data-id"), 10) ||
      parseInt($("#main-wrapper").attr("data-id"), 10) ||
      null;

    // ── Step 3: Extract anilist_id from banner background-image ───────────
    // Pattern: background-image: url('https://s4.anilist.co/file/anilistcdn/media/anime/banner/169755-xxx.jpg')
    let anilistId = null;
    const bgStyle =
      $("#player").attr("style") ||
      $("[style*='anilistcdn']").attr("style") ||
      $("[style*='s4.anilist.co']").attr("style") ||
      "";
    const anilistMatch = bgStyle.match(/anilistcdn\/media\/anime\/banner\/(\d+)/);
    if (anilistMatch) anilistId = parseInt(anilistMatch[1], 10);

    // ── Step 4: Detect page type ───────────────────────────────────────────
    //
    // TYPE 1 (anikoto-style):
    //   - No anilist CDN banner → but may have it on anikoto
    //   - Has .bmeta with "Episodes: <span>N</span>"
    //   - Has NO AJAX episode list (episodes are count-only)
    //   We detect this by checking whether the page is served from WATCH_URL
    //   and whether it matches the anikoto DOM structure.
    //
    // TYPE 2 (hianime-style):
    //   - Has #main-wrapper[data-id] numeric id
    //   - Episodes fetched via /ajax/v2/episode/list/{siteId}

    const isAnikotoStyle = WATCH_CONFIG.watchUrl !== WATCH_CONFIG.hiAnimeUrl;

    if (isAnikotoStyle) {
      return await handleAnikotoPage($, id, siteId, anilistId);
    } else {
      return await handleHiAnimePage($, id, siteId, anilistId);
    }
  } catch (err) {
    console.error("[/api/watch-episodes]", err);
    return errorResponse(err.message || "Failed to fetch episodes");
  }
}

// ── Type 1: Anikoto-style — count only ───────────────────────────────────────

async function handleAnikotoPage($, animeId, siteId, anilistId) {
  // Extract total episode count from .bmeta
  let totalEpisodes = null;

  $(".bmeta .meta div").each((_, el) => {
    const text = $(el).text();
    if (/Episodes/i.test(text)) {
      const num = parseInt($(el).find("span").text().trim(), 10);
      if (!isNaN(num)) totalEpisodes = num;
    }
  });

  // Fallback: look for any "Episodes" label in the info block
  if (totalEpisodes === null) {
    const epText = $("*:contains('Episodes')").filter((_, el) => {
      return $(el).children().length === 0 || $(el).find("span").length > 0;
    }).filter((_, el) => /^\s*Episodes\s*$/.test($(el).clone().children().remove().end().text()));
    epText.each((_, el) => {
      const num = parseInt($(el).find("span").first().text(), 10);
      if (!isNaN(num)) { totalEpisodes = num; return false; }
    });
  }

  return jsonResponse({
    pageType: "count-only",
    data: {
      animeId,
      siteId,
      anilistId,
      totalEpisodes,
      episodes: null,
      streaming: buildStreamingUrls(anilistId, null),
    },
  }, CONFIG.CACHE.EPISODES);
}

// ── Type 2: HiAnime-style — full episode list ─────────────────────────────────

async function handleHiAnimePage($, animeId, siteId, anilistId) {
  if (!siteId) throw new Error(`Could not resolve numeric site ID for: ${animeId}`);

  // Fetch episode list via AJAX (same as existing scrapeEpisodes)
  const ajaxHtml = await fetchHTML(
    `${WATCH_CONFIG.hiAnimeUrl}/ajax/v2/episode/list/${siteId}`,
    CONFIG.AJAX_HEADERS
  );
  const $ep = cheerio.load(ajaxHtml);

  const episodes = [];
  $ep(".ssl-item.ep-item, .ssl-item").each((_, el) => {
    const ep = formatEpisode($ep(el), $ep);
    if (ep.number !== null) episodes.push(ep);
  });

  return jsonResponse({
    pageType: "episode-list",
    data: {
      animeId,
      siteId,
      anilistId,
      totalEpisodes: episodes.length,
      episodes,
      streaming: buildStreamingUrls(anilistId, null),
    },
  }, CONFIG.CACHE.EPISODES);
}

// ── Streaming URL builder ─────────────────────────────────────────────────────

function buildStreamingUrls(anilistId, episodeNumber) {
  if (!anilistId) return null;
  return {
    sub: episodeNumber
      ? WATCH_CONFIG.videoSrc.sub(anilistId, episodeNumber)
      : WATCH_CONFIG.videoSrc.subTemplate(anilistId),
    dub: episodeNumber
      ? WATCH_CONFIG.videoSrc.dub(anilistId, episodeNumber)
      : WATCH_CONFIG.videoSrc.dubTemplate(anilistId),
  };
}
