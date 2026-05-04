// ─── GET /api/watch-episode-detail ───────────────────────────────────────────
//
// Returns detailed info + streaming URLs for a specific episode.
//
// Route (via vercel.json rewrite):
//   GET /api/v2/hianime/:animeId/ep:number
//   → GET /api/watch-episode-detail?id=:animeId&ep=:number
//
// Query params:
//   id   {string}  Anime slug  (e.g. "bleach-thousand-year-blood-war-the-conflict-sqamb")
//   ep   {number}  Episode number  (e.g. 1, 14, 366)
//
// Response:
// {
//   success: true,
//   data: {
//     animeId: "bleach-yaa9n",
//     episodeNumber: 1,
//     siteId: 1057,
//     anilistId: 169755,
//     episodeId: "bleach-yaa9n?ep=1",
//     title: "The Day I Became a Shinigami",
//     isFiller: false,
//     streaming: {
//       sub: "https://megaplay.buzz/stream/ani/269/1/sub",
//       dub: "https://megaplay.buzz/stream/ani/269/1/dub"
//     }
//   }
// }
//
// The anilistId is extracted from the watch page banner background-image.
// If unavailable, streaming URLs will be null.

export const config = { runtime: "edge" };

import * as cheerio from "cheerio";
import { jsonResponse, errorResponse, fetchPage, fetchHTML, clean } from "../util/helper.js";
import { formatEpisode } from "../util/format.js";
import { CONFIG } from "../config/config.js";
import { WATCH_CONFIG } from "../config/watchurl.js";

export default async function handler(req) {
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();
  const ep = parseInt(searchParams.get("ep"), 10);

  if (!id)        return errorResponse("Missing required param: id (anime slug)", 400);
  if (isNaN(ep))  return errorResponse("Missing or invalid param: ep (episode number)", 400);

  try {
    // ── Fetch watch page to resolve anilist id + site id ──────────────────
    const watchUrl = `${WATCH_CONFIG.watchUrl}/watch/${id}`;
    const html     = await fetchPage(watchUrl, CONFIG.REQUEST_HEADERS);
    const $        = cheerio.load(html);

    // Numeric site id
    const siteId =
      parseInt($("#watch-main").attr("data-id"), 10) ||
      parseInt($("#main-wrapper").attr("data-id"), 10) ||
      null;

    // Anilist id from banner bg-image
    let anilistId = null;
    const bgStyle =
      $("#player").attr("style") ||
      $("[style*='anilistcdn']").attr("style") ||
      $("[style*='s4.anilist.co']").attr("style") ||
      "";
    const anilistMatch = bgStyle.match(/anilistcdn\/media\/anime\/banner\/(\d+)/);
    if (anilistMatch) anilistId = parseInt(anilistMatch[1], 10);

    // ── Try to get episode title from AJAX list (hianime-style pages) ──────
    let episodeTitle  = null;
    let episodeId     = `${id}?ep=${ep}`;
    let isFiller      = false;

    if (siteId) {
      try {
        const ajaxHtml = await fetchHTML(
          `${WATCH_CONFIG.hiAnimeUrl}/ajax/v2/episode/list/${siteId}`,
          CONFIG.AJAX_HEADERS
        );
        const $ep = cheerio.load(ajaxHtml);

        $ep(".ssl-item.ep-item, .ssl-item").each((_, el) => {
          const num = parseInt($ep(el).attr("data-number"), 10);
          if (num === ep) {
            const formatted = formatEpisode($ep(el), $ep);
            episodeTitle = formatted.title;
            episodeId    = formatted.episodeId || episodeId;
            isFiller     = formatted.isFiller;
            return false; // break
          }
        });
      } catch (_) {
        // AJAX failed — title stays null, streaming still works via anilistId
      }
    }

    // ── Build streaming URLs ───────────────────────────────────────────────
    const streaming = anilistId ? {
      sub: WATCH_CONFIG.videoSrc.sub(anilistId, ep),
      dub: WATCH_CONFIG.videoSrc.dub(anilistId, ep),
    } : null;

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
    console.error("[/api/watch-episode-detail]", err);
    return errorResponse(err.message || "Failed to fetch episode detail");
  }
}
