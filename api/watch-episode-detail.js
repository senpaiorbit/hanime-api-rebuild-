// ─── GET /api/watch-episode-detail ───────────────────────────────────────────
//
// Returns detailed info + streaming URLs for a specific episode.
//
// Route (via vercel.json rewrite):
//   GET /api/v2/hianime/:animeId/ep:number
//   → GET /api/watch-episode-detail?id=:animeId&ep=:number
//
// Query params:
//   id   {string}  Anime slug  (e.g. "bleach-yaa9n")
//   ep   {number}  Episode number  (e.g. 1, 14, 366)
//
// How anilist_id is resolved:
//   The watch page embeds it in the #player background-image:
//     background-image: url('https://s4.anilist.co/file/anilistcdn/media/anime/banner/172463-xxx.jpg')
//   → anilistId = 172463
//
// Streaming URLs are always built from the anilistId if available:
//   sub → https://megaplay.buzz/stream/ani/{anilistId}/{ep}/sub
//   dub → https://megaplay.buzz/stream/ani/{anilistId}/{ep}/dub
//
// Episode title resolution:
//   • When watchUrl is hianime.re: fetched from /ajax/v2/episode/list/{siteId}
//   • When watchUrl is anikoto   : titles are not available (count-only pages)
//
// Response:
// {
//   success: true,
//   data: {
//     animeId: "jujutsu-kaisen-the-culling-game-part-1-bnf0c",
//     episodeNumber: 1,
//     siteId: 7891,
//     anilistId: 172463,
//     episodeId: "jujutsu-kaisen-the-culling-game-part-1-bnf0c?ep=1",
//     title: "Beginning and End",
//     isFiller: false,
//     streaming: {
//       sub: "https://megaplay.buzz/stream/ani/172463/1/sub",
//       dub: "https://megaplay.buzz/stream/ani/172463/1/dub"
//     }
//   }
// }
//
// All HTTP requests use axios (no browser-side AJAX, no jQuery).

import axios from "axios";
import * as cheerio from "cheerio";
import { jsonResponse, errorResponse } from "../util/helper.js";
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
  const ep = parseInt(searchParams.get("ep"), 10);

  if (!id)       return errorResponse("Missing required param: id (anime slug)", 400);
  if (isNaN(ep)) return errorResponse("Missing or invalid param: ep (episode number)", 400);

  try {
    // ── Step 1: Fetch the watch page via axios ─────────────────────────────
    const watchUrl = `${WATCH_CONFIG.watchUrl}/watch/${id}`;
    const res = await axios.get(watchUrl, {
      headers: CONFIG.REQUEST_HEADERS,
      timeout: 20000,
      responseType: "text",
    });
    const $ = cheerio.load(res.data);

    // ── Step 2: Resolve numeric site-internal id ───────────────────────────
    const siteId =
      parseInt($("#watch-main").attr("data-id"), 10) ||
      parseInt($("#main-wrapper").attr("data-id"), 10) ||
      null;

    // ── Step 3: Extract anilist_id from banner background-image ───────────
    // url('https://s4.anilist.co/file/anilistcdn/media/anime/banner/172463-xxx.jpg')
    const anilistId = extractAnilistId($);

    // ── Step 4: Try to get the episode title ──────────────────────────────
    // Title lookup only works on hianime (anikoto pages are count-only).
    let episodeTitle = null;
    let episodeId    = `${id}?ep=${ep}`;
    let isFiller     = false;

    const isHianime = WATCH_CONFIG.watchUrl.includes("hianime");

    if (isHianime && siteId) {
      try {
        const epRes = await axios.get(
          `${WATCH_CONFIG.hiAnimeUrl}/ajax/v2/episode/list/${siteId}`,
          {
            headers: CONFIG.AJAX_HEADERS,
            timeout: 15000,
          }
        );

        const payload = epRes.data;
        const rawHtml = typeof payload === "object"
          ? (payload.html || payload.content || "")
          : String(payload);

        const $ep = cheerio.load(rawHtml);

        $ep(".ssl-item.ep-item, .ssl-item").each((_, el) => {
          const num = parseInt($ep(el).attr("data-number"), 10);
          if (num === ep) {
            const formatted  = formatEpisode($ep(el), $ep);
            episodeTitle     = formatted.title  || null;
            episodeId        = formatted.episodeId || episodeId;
            isFiller         = formatted.isFiller  || false;
            return false; // break
          }
        });
      } catch (fetchErr) {
        // Episode title unavailable — streaming still works via anilistId
        console.warn(`[watch-episode-detail] Title lookup failed for ${id} ep ${ep}:`, fetchErr.message);
      }
    }

    // ── Step 5: Build streaming URLs ──────────────────────────────────────
    // Uses anilist_id extracted from the banner background-image.
    const streaming = anilistId
      ? {
          sub: WATCH_CONFIG.videoSrc.sub(anilistId, ep),
          dub: WATCH_CONFIG.videoSrc.dub(anilistId, ep),
        }
      : null;

    return jsonResponse({
      data: {
        animeId:       id,
        episodeNumber: ep,
        siteId,
        anilistId,
        episodeId,
        title:         episodeTitle,
        isFiller,
        streaming,
      },
    }, CONFIG.CACHE.EPISODES);
  } catch (err) {
    console.error("[/api/watch-episode-detail]", err.message);
    return errorResponse(
      err.response?.status === 404
        ? `Anime not found: ${id}`
        : (err.message || "Failed to fetch episode detail")
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract AniList numeric ID from the #player background-image style.
 * e.g. background-image: url('https://s4.anilist.co/file/anilistcdn/media/anime/banner/172463-xxx.jpg')
 *   → 172463
 * Returns null when a non-anilist CDN image is used (e.g. older Bleach page).
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
