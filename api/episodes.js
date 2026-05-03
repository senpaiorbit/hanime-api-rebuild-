// ─── GET /api/episodes ────────────────────────────────────────────────────────
// Supports two calling conventions:
//
//   1. Path param  (via vercel.json rewrite):
//      GET /api/v2/hianime/anime/:animeId/episodes
//      → internally rewritten to GET /api/episodes?id=:animeId
//
//   2. Query param (direct / legacy):
//      GET /api/episodes?id=bleach-yaa9n
//
// Response:
// {
//   success: true,
//   data: {
//     totalEpisodes: 366,
//     episodes: [
//       { number: 1, title: "The Day I Became a Shinigami", episodeId: "bleach-yaa9n?ep=1", isFiller: false },
//       ...
//     ]
//   }
// }

export const config = { runtime: "edge" };

import { scrapeEpisodes, scrapeAnimeNumericId } from "../util/scraper.js";
import { CONFIG } from "../config/config.js";

export default async function handler(req) {
  if (req.method !== "GET") {
    return Response.json(
      { success: false, data: null, error: "Method not allowed" },
      { status: 405 }
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();

  if (!id) {
    return Response.json(
      { success: false, data: null, error: "Missing required param: id (anime slug)" },
      { status: 400 }
    );
  }

  try {
    // Resolve the numeric site ID from the watch page (#main-wrapper[data-id])
    const numericId = await scrapeAnimeNumericId(id);
    const data      = await scrapeEpisodes(numericId);

    const ttl = CONFIG.CACHE.EPISODES;
    return Response.json(
      { success: true, data },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": ttl > 0
            ? `public, s-maxage=${ttl}, stale-while-revalidate=${Math.floor(ttl / 2)}`
            : "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("[/api/episodes]", err);
    return Response.json(
      { success: false, data: null, error: err.message || "Failed to fetch episodes" },
      { status: 500 }
    );
  }
}
