// ─── GET /api/watch ───────────────────────────────────────────────────────────
//
// Routes:
//   /api/v2/hianime/:animeId/episodes          → list all episodes
//   /api/v2/hianime/:animeId/ep:number         → single episode details + stream URLs
//
// Type 1 pages (non-anilist banner): return totalEpisodes only from tick counts
// Type 2 pages (anilist banner):     return full episode list with titles + stream URLs
//
// Stream URL config:
//   watchurl    = https://anikototv.to
//   videosrc.sub = https://megaplay.buzz/stream/ani/{anilist_id}/{ep_num}/sub
//   videosrc.dub = https://megaplay.buzz/stream/ani/{anilist_id}/{ep_num}/dub

export const config = { runtime: "edge" };

import {
  scrapeWatchEpisodes,
  scrapeWatchEpisodeSingle,
} from "../util/scraper.js";
import { errorResponse, jsonResponse, intParam } from "../util/helper.js";
import { CONFIG } from "../config/config.js";

export default async function handler(req) {
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);

  const { searchParams } = new URL(req.url);
  const animeId  = searchParams.get("id")?.trim();
  const epNumber = searchParams.get("ep")?.trim();   // set by vercel rewrite for /ep:number

  if (!animeId) return errorResponse("Missing required param: id (anime slug)", 400);

  try {
    if (epNumber) {
      const num  = intParam(epNumber, null);
      if (!num) return errorResponse("Invalid episode number", 400);
      const data = await scrapeWatchEpisodeSingle(animeId, num);
      return jsonResponse(data, CONFIG.CACHE.EPISODES);
    }

    const data = await scrapeWatchEpisodes(animeId);
    return jsonResponse(data, CONFIG.CACHE.EPISODES);
  } catch (err) {
    console.error("[/api/watch]", err);
    return errorResponse(err.message || "Failed to fetch watch/episode data");
  }
}
