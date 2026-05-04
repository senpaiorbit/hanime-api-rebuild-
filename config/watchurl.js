// ─── Watch URL + Video Source Config ─────────────────────────────────────────
//
// watchUrl     — The primary anime streaming site to scrape watch pages from.
//                Set this to your deployment (e.g. anikototv.to or hianime.re).
//
// hiAnimeUrl   — HiAnime base URL used exclusively to hit the
//                /ajax/v2/episode/list/{id} AJAX endpoint for episode titles.
//                If watchUrl == hiAnimeUrl, the page is treated as "episode-list" type.
//                If watchUrl != hiAnimeUrl (e.g. anikoto), it's "count-only" type.
//
// videoSrc     — Streaming URL templates for sub/dub playback.
//                Uses anilist_id (extracted from the watch page banner) + episode number.
//
// Usage in API responses:
//   streaming.sub = "https://megaplay.buzz/stream/ani/169755/14/sub"
//   streaming.dub = "https://megaplay.buzz/stream/ani/169755/14/dub"

const HIANIME_URL = "https://hianime.re";

// ── Primary watch site ────────────────────────────────────────────────────────
// Change this to switch between anikoto and hianime as the page-scrape source.
const WATCH_URL = "https://anikototv.to";

// ── Streaming base ────────────────────────────────────────────────────────────
const MEGAPLAY_BASE = "https://megaplay.buzz/stream/ani";

export const WATCH_CONFIG = {
  // The site whose /watch/{slug} pages are scraped for episode data
  watchUrl: WATCH_URL,

  // HiAnime — used for /ajax/v2/episode/list/{numericId} regardless of watchUrl
  hiAnimeUrl: HIANIME_URL,

  // Streaming URL builders
  videoSrc: {
    /**
     * Build a sub stream URL for a specific episode.
     * @param {number} anilistId  — extracted from banner bg-image
     * @param {number} episodeNum — episode number
     * @returns {string}
     */
    sub: (anilistId, episodeNum) =>
      `${MEGAPLAY_BASE}/${anilistId}/${episodeNum}/sub`,

    /**
     * Build a dub stream URL for a specific episode.
     */
    dub: (anilistId, episodeNum) =>
      `${MEGAPLAY_BASE}/${anilistId}/${episodeNum}/dub`,

    /**
     * Template strings (no episode number — for episode-list responses).
     * Replace {ep} client-side.
     */
    subTemplate: (anilistId) => `${MEGAPLAY_BASE}/${anilistId}/{ep}/sub`,
    dubTemplate: (anilistId) => `${MEGAPLAY_BASE}/${anilistId}/{ep}/dub`,
  },
};
