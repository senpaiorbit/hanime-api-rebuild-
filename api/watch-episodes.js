// ─── GET /api/watch-episodes ───────────────────────────────────────────────────
//
// Route (via vercel.json rewrite):
//   GET /api/v2/hianime/:animeId/episodes
//   → GET /api/watch-episodes?id=:animeId
//
// Scrapes the watch page and auto-detects one of TWO page types:
//
// ── TYPE 1 – "count-only" ─────────────────────────────────────────────────────
//   Triggered when:
//     • watchUrl is anikototv.to (the .bmeta block has total episode count),  OR
//     • watchUrl is hianime.re but no episode list is returned from the server
//
//   The page does NOT render individual episode titles in HTML.
//   Total episode count is read from:
//     1. .bmeta .meta div containing "Episodes" label  (anikoto style)
//     2. .tick-sub / .tick-dub badge numbers           (hianime / fallback)
//
//   Response:
//   {
//     pageType: "count-only",
//     data: {
//       animeId: "bleach-yaa9n",
//       siteId: 1057,
//       anilistId: null,          // null if no anilist CDN banner on the page
//       totalEpisodes: 366,
//       episodes: null,
//       streaming: null           // null when anilistId is unavailable
//     }
//   }
//
// ── TYPE 2 – "episode-list" ───────────────────────────────────────────────────
//   Triggered when:
//     • watchUrl is hianime.re AND the /ajax/v2/episode/list/{siteId} endpoint
//       returns a non-empty HTML list of .ssl-item nodes with titles.
//
//   Response:
//   {
//     pageType: "episode-list",
//     data: {
//       animeId: "jujutsu-kaisen-the-culling-game-part-1-bnf0c",
//       siteId: 7891,
//       anilistId: 172463,
//       totalEpisodes: 12,
//       episodes: [
//         { number: 1, title: "Beginning and End", episodeId: "...", isFiller: false },
//         ...
//       ],
//       streaming: {
//         sub: "https://megaplay.buzz/stream/ani/172463/{ep}/sub",
//         dub: "https://megaplay.buzz/stream/ani/172463/{ep}/dub"
//       }
//     }
//   }
//
// How anilist_id is resolved:
//   The watch page embeds it in the #player background-image style:
//     background-image: url('https://s4.anilist.co/file/anilistcdn/media/anime/banner/172463-xxx.jpg')
//   → anilistId = 172463
//
//   Bleach-style older pages use a non-anilist CDN image → anilistId = null.
//
// All HTTP requests use axios (no browser-side AJAX, no jQuery).

import axios from "axios";
import * as cheerio from "cheerio";
import { jsonResponse, errorResponse, clean } from "../util/helper.js";
import { formatEpisode } from "../util/format.js";
import { CONFIG } from "../config/config.js";
import { WATCH_CONFIG } from "../config/watchurl.js";

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();
  if (!id) return errorResponse("Missing required param: id (anime slug)", 400);

  try {
    // ── Step 1: Fetch the watch page via axios ─────────────────────────────
    const watchUrl = `${WATCH_CONFIG.watchUrl}/watch/${id}`;
    const res = await axios.get(watchUrl, {
      headers: CONFIG.REQUEST_HEADERS,
      timeout: 20000,
      responseType: "text",
    });
    const $ = cheerio.load(res.data);

    // ── Step 2: Resolve numeric site-internal ID ───────────────────────────
    // anikoto uses #watch-main[data-id], hianime uses #main-wrapper[data-id]
    const siteId =
      parseInt($("#watch-main").attr("data-id"), 10) ||
      parseInt($("#main-wrapper").attr("data-id"), 10) ||
      null;

    // ── Step 3: Extract anilist_id from banner background-image ───────────
    // Pattern: url('https://s4.anilist.co/file/anilistcdn/media/anime/banner/172463-xxx.jpg')
    const anilistId = extractAnilistId($);

    // ── Step 4: Route to the correct page-type handler ────────────────────
    const isAnikoto = WATCH_CONFIG.watchUrl.includes("anikoto");

    if (isAnikoto) {
      // Anikoto pages never expose an inline episode list — always count-only
      return handleCountOnly($, id, siteId, anilistId, "anikoto");
    } else {
      // HiAnime pages: try to get full episode list, fall back to count-only
      return await handleHiAnimePage($, id, siteId, anilistId);
    }
  } catch (err) {
    console.error("[/api/watch-episodes]", err.message);
    return errorResponse(err.response?.status === 404
      ? `Anime not found: ${id}`
      : (err.message || "Failed to fetch episodes"));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Type 1 – Count-only handler  (anikoto style OR hianime fallback)
// ─────────────────────────────────────────────────────────────────────────────

function handleCountOnly($, animeId, siteId, anilistId, source = "unknown") {
  let totalEpisodes = null;

  // ── Strategy A: .bmeta Episodes label (anikoto DOM) ─────────────────────
  // HTML: <div>Episodes: <span>12</span></div>
  $(".bmeta .meta div, .anisc-info .item").each((_, el) => {
    const rawText = $(el).text();
    if (/Episodes?/i.test(rawText)) {
      // Prefer explicit span value
      const spanVal = parseInt($(el).find("span").first().text().trim(), 10);
      if (!isNaN(spanVal)) { totalEpisodes = spanVal; return false; }

      // Fallback: extract digits from raw text
      const match = rawText.match(/(\d+)/);
      if (match) { totalEpisodes = parseInt(match[1], 10); return false; }
    }
  });

  // ── Strategy B: tick-sub / tick-dub badge (hianime DOM / all fallback) ──
  // HTML: <div class="tick-item tick-sub"><i class="fas fa-closed-captioning"></i> 366</div>
  if (totalEpisodes === null) {
    const sub = extractTickCount($, ".tick-sub");
    const dub = extractTickCount($, ".tick-dub");
    totalEpisodes = sub || dub || null;
  }

  return jsonResponse({
    pageType: "count-only",
    source,
    data: {
      animeId,
      siteId,
      anilistId,
      totalEpisodes,
      episodes: null,
      streaming: buildStreamingTemplates(anilistId),
    },
  }, CONFIG.CACHE.EPISODES);
}

// ─────────────────────────────────────────────────────────────────────────────
// Type 2 – HiAnime full episode-list handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleHiAnimePage($, animeId, siteId, anilistId) {
  if (!siteId) {
    // No numeric id to query — fall back to tick counts
    return handleCountOnly($, animeId, siteId, anilistId, "hianime-no-id");
  }

  let episodes = [];

  try {
    // Real server-side scraping of the episode list endpoint (no browser AJAX)
    const epRes = await axios.get(
      `${WATCH_CONFIG.hiAnimeUrl}/ajax/v2/episode/list/${siteId}`,
      {
        headers: CONFIG.AJAX_HEADERS,
        timeout: 20000,
      }
    );

    // axios auto-parses JSON; the response has shape { html: "…" }
    const payload = epRes.data;
    const rawHtml = typeof payload === "object"
      ? (payload.html || payload.content || "")
      : String(payload);

    const $ep = cheerio.load(rawHtml);

    $ep(".ssl-item.ep-item, .ssl-item").each((_, el) => {
      const ep = formatEpisode($ep(el), $ep);
      if (ep.number !== null) episodes.push(ep);
    });
  } catch (fetchErr) {
    console.warn(`[watch-episodes] Episode list fetch failed for siteId ${siteId}:`, fetchErr.message);
    // Fall through to count-only using tick badges from the main page
  }

  // If the AJAX call returned no usable episodes → count-only fallback
  if (episodes.length === 0) {
    return handleCountOnly($, animeId, siteId, anilistId, "hianime-fallback");
  }

  return jsonResponse({
    pageType: "episode-list",
    source: "hianime",
    data: {
      animeId,
      siteId,
      anilistId,
      totalEpisodes: episodes.length,
      episodes,
      streaming: buildStreamingTemplates(anilistId),
    },
  }, CONFIG.CACHE.EPISODES);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the AniList numeric ID from any element whose style contains an
 * anilist CDN banner URL.
 *
 * e.g. background-image: url('https://s4.anilist.co/file/anilistcdn/media/anime/banner/172463-xxx.jpg')
 *   → 172463
 *
 * Returns null when the page uses a non-anilist CDN image (e.g. Bleach on
 * hianime uses cbrimages.com).
 */
function extractAnilistId($) {
  const candidates = [
    $("#player").attr("style"),
    $("[style*='anilistcdn']").first().attr("style"),
    $("[style*='s4.anilist.co']").first().attr("style"),
  ];
  for (const style of candidates) {
    if (!style) continue;
    const m = style.match(/anilistcdn\/media\/anime\/banner\/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

/**
 * Read a tick badge count, stripping the icon <i> child before parsing.
 * HTML: <div class="tick-item tick-sub"><i class="fas fa-closed-captioning"></i> 366</div>
 */
function extractTickCount($, selector) {
  const text = $(selector)
    .first()
    .clone()
    .children()
    .remove()
    .end()
    .text()
    .replace(/\D/g, "")
    .trim();
  const n = parseInt(text, 10);
  return isNaN(n) ? null : n;
}

/**
 * Build streaming URL templates (client replaces {ep} with episode number).
 * Returns null when anilistId is unavailable.
 */
function buildStreamingTemplates(anilistId) {
  if (!anilistId) return null;
  return {
    sub: WATCH_CONFIG.videoSrc.subTemplate(anilistId),
    dub: WATCH_CONFIG.videoSrc.dubTemplate(anilistId),
    note: "Replace {ep} with the episode number to build the streaming URL.",
  };
}
