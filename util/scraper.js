// ─── HiAnime Scraper ─────────────────────────────────────────────────────────

import * as cheerio from "cheerio";
import { fetchPage, fetchJSON, clean, extractId, extractWatchId } from "../util/helper.js";
import {
  formatFilmCard,
  formatSpotlight,
  formatTrendingItem,
  formatMostPopular,
  formatAnimeInfo,
  formatRecommendedAnime,
  formatRelatedAnime,
  formatEpisode,
  formatServer,
  formatSearchSuggestion,
  parseTotalPages,
} from "../util/format.js";
import { URLS, BASE_URL } from "../config/baseurl.js";

// ── Home Page ─────────────────────────────────────────────────────────────────

export async function scrapeHome() {
  const html = await fetchPage(URLS.home());
  const $ = cheerio.load(html);

  // ── Spotlight slider ──────────────────────────────────────────────────────
  const spotlight = [];
  // Each slide lives inside .deslide-wrap .swiper-slide — pick only slides
  // that contain a .deslide-item (avoids phantom empty slides)
  $("#slider .swiper-slide .deslide-item").each((i, el) => {
    spotlight.push(formatSpotlight($(el), $, i + 1));
  });

  // ── Trending ──────────────────────────────────────────────────────────────
  // The trending carousel is #trending-home .swiper-slide .inner
  // NOT .anif-block-ul (that is the sidebar "Popular/New Release/…" block)
  const trending = [];
  $("#trending-home .swiper-slide .inner").each((i, el) => {
    trending.push(formatTrendingItem($(el), $, i + 1));
  });

  // ── Generic section helper ────────────────────────────────────────────────
  const parseSection = (selector) => {
    const list = [];
    $(selector).find(".flw-item").each((_, el) => list.push(formatFilmCard($(el), $)));
    return list;
  };

  return {
    spotlight,
    trending,
    // "Latest Episode" section has id="recent-update"
    latestEpisode: parseSection("#recent-update"),
    // "Top Upcoming" section — find the block_area whose heading says "Top Upcoming"
    topUpcoming: (() => {
      let section = null;
      $("#main-content .block_area_home").each((_, el) => {
        if ($(el).find(".cat-heading").text().trim().includes("Top Upcoming")) {
          section = $(el);
        }
      });
      if (!section) return [];
      const list = [];
      section.find(".flw-item").each((_, el) => list.push(formatFilmCard($(el), $)));
      return list;
    })(),
    top10: {
      // The sidebar Most-Viewed tabs use IDs: top-viewed-day / top-viewed-week / top-viewed-month
      today: parseSideChart($, "top-viewed-day"),
      week:  parseSideChart($, "top-viewed-week"),
      month: parseSideChart($, "top-viewed-month"),
    },
    genres: scrapeGenreList($),
  };
}

function parseSideChart($, tabId) {
  const list = [];
  $(`#${tabId} li`).each((i, el) => {
    const anchor = $(el).find("a").first();
    const href   = anchor.attr("href") || "";
    list.push({
      rank: i + 1,
      id:   extractId(href),
      name: clean($(el).find(".film-name").text()),
      episodes: {
        sub: parseInt($(el).find(".tick-sub").text(), 10) || null,
        dub: parseInt($(el).find(".tick-dub").text(), 10) || null,
      },
    });
  });
  return list;
}

function scrapeGenreList($) {
  const genres = [];
  $(".nav-item a[href*='/genre/']").each((_, el) => {
    genres.push(clean($(el).text()));
  });
  return [...new Set(genres)];
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function scrapeSearch(query, page = 1, filters = {}) {
  let url = URLS.search(query, page);
  for (const [k, v] of Object.entries(filters)) {
    if (v) url += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
  }
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const animes = [];
  $(".flw-item").each((_, el) => animes.push(formatFilmCard($(el), $)));

  const totalPages = parseTotalPages($);
  const totalCount = parseInt(
    clean($(".pre-pagination ~ .cat-heading").text()).replace(/\D/g, ""), 10
  ) || animes.length;

  return { query, page, totalPages, totalCount, animes };
}

// ── Search Suggestions ────────────────────────────────────────────────────────

export async function scrapeSearchSuggestions(query) {
  const data = await fetchJSON(URLS.searchSuggest(query));
  const html = data.html || "";
  const $ = cheerio.load(html);

  const suggestions = [];
  $(".nav-item, li").each((_, el) => {
    const item = formatSearchSuggestion($(el), $);
    if (item.id) suggestions.push(item);
  });

  return { query, suggestions };
}

// ── Anime Info (full) ─────────────────────────────────────────────────────────

export async function scrapeAnimeInfo(animeId) {
  const html = await fetchPage(URLS.animeInfo(animeId));
  const $ = cheerio.load(html);

  // Core info + moreInfo + any seasons already on main page
  const { info, moreInfo, seasons: pageSeason } = formatAnimeInfo($, animeId);

  // Recommended from main page grid
  const recommendedAnimes = [];
  $(".block_area_category .flw-item").each((_, el) =>
    recommendedAnimes.push(formatRecommendedAnime($(el), $))
  );

  // Most popular from sidebar trending
  const mostPopularAnimes = [];
  $(".block_area-realtime .anif-block-ul li, .cbox-realtime li").each((_, el) =>
    mostPopularAnimes.push(formatMostPopular($(el), $))
  );

  // Resolve numeric ID for AJAX calls
  const numericId = await scrapeAnimeNumericId(animeId).catch(() => null);

  // AJAX: Related animes
  const relatedAnimes = numericId
    ? await scrapeRelatedAnimes(numericId).catch(() => [])
    : [];

  // AJAX: Promotional videos
  const promotionalVideos = numericId
    ? await scrapePromoVideos(numericId).catch(() => [])
    : [];

  // AJAX: Character + voice actors
  const characterVoiceActor = numericId
    ? await scrapeCharacterVoiceActors(numericId).catch(() => [])
    : [];

  // AJAX: Seasons (if not already on page)
  const seasons = pageSeason.length > 0
    ? pageSeason
    : numericId
      ? await scrapeSeasons(numericId).catch(() => [])
      : [];

  // Merge promo + character into info
  info.promotionalVideos    = promotionalVideos;
  info.characterVoiceActor  = characterVoiceActor;

  return {
    anime: [{ info, moreInfo }],
    mostPopularAnimes,
    recommendedAnimes,
    relatedAnimes,
    seasons,
  };
}

// ── AJAX: Related Animes ──────────────────────────────────────────────────────

export async function scrapeRelatedAnimes(numericId) {
  const data = await fetchJSON(`${BASE_URL}/ajax/anime/related?id=${numericId}`);
  const html = data.html || "";
  const $ = cheerio.load(html);
  const related = [];
  $(".flw-item").each((_, el) => related.push(formatRelatedAnime($(el), $)));
  return related;
}

// ── AJAX: Promotional Videos ──────────────────────────────────────────────────

export async function scrapePromoVideos(numericId) {
  const data = await fetchJSON(`${BASE_URL}/ajax/anime/videos?id=${numericId}`);
  const html = data.html || data.promo || "";
  const $ = cheerio.load(html);
  const videos = [];

  $(".item, .block-slide-item, li").each((_, el) => {
    const title     = clean($(el).find(".title, .name, h4").text()) || undefined;
    const source    = $(el).find("a").attr("href") || $(el).attr("data-src") || undefined;
    const thumbnail = $(el).find("img").attr("data-src") || $(el).find("img").attr("src") || undefined;
    if (source || thumbnail) videos.push({ title, source, thumbnail });
  });

  return videos;
}

// ── AJAX: Character + Voice Actors ───────────────────────────────────────────

export async function scrapeCharacterVoiceActors(numericId) {
  const data = await fetchJSON(`${BASE_URL}/ajax/character/list/${numericId}`);
  const html = data.html || "";
  const $ = cheerio.load(html);
  const cast = [];

  const parsePerInfo = ($pi) => {
    const a    = $pi.find("a").first();
    const href = a.attr("href") || "";
    return {
      id:     extractId(href),
      poster: $pi.find("img").attr("data-src") || $pi.find("img").attr("src") || null,
      name:   clean($pi.find(".pi-name a, .name").first().text()),
      cast:   clean($pi.find(".pi-cast, .cast").text()) || null,
    };
  };

  $(".bac-item, .cast-item").each((_, el) => {
    const chars  = $(el).find(".per-info.ltr, .character");
    const voices = $(el).find(".per-info.rtl, .voice-actor");
    if (chars.length && voices.length) {
      cast.push({
        character:  parsePerInfo(chars.first()),
        voiceActor: parsePerInfo(voices.first()),
      });
    }
  });

  return cast;
}

// ── AJAX: Seasons ─────────────────────────────────────────────────────────────

export async function scrapeSeasons(numericId) {
  const data = await fetchJSON(`${BASE_URL}/ajax/anime/season/list/${numericId}`);
  const html = data.html || "";
  const $ = cheerio.load(html);
  const seasons = [];

  $(".os-item, .ss-item").each((_, el) => {
    const a    = $(el).find("a").first();
    const href = a.attr("href") || "";
    seasons.push({
      id:        extractId(href),
      name:      clean($(el).find(".title, .name").text()) || clean(a.text()),
      title:     a.attr("title") || clean(a.text()) || null,
      poster:    $(el).find("img").attr("data-src") || $(el).find("img").attr("src") || null,
      isCurrent: $(el).hasClass("active") || $(el).hasClass("selected"),
    });
  });

  return seasons;
}

// ── Resolve Numeric ID ────────────────────────────────────────────────────────

export async function scrapeAnimeNumericId(slug) {
  const html = await fetchPage(URLS.animeWatch(slug));
  const $ = cheerio.load(html);
  const id = $("#main-wrapper").attr("data-id");
  if (!id) throw new Error(`Could not resolve numeric ID for: ${slug}`);
  return id;
}

// ── Episodes ──────────────────────────────────────────────────────────────────

export async function scrapeEpisodes(animeId) {
  const data = await fetchJSON(URLS.episodes(animeId));
  const html = data.html || "";
  const $ = cheerio.load(html);

  const episodes = [];
  $(".ssl-item").each((_, el) => episodes.push(formatEpisode($(el), $)));

  return { animeId, totalEpisodes: episodes.length, episodes };
}

// ── Episode Servers ───────────────────────────────────────────────────────────

export async function scrapeEpisodeServers(episodeId) {
  const data = await fetchJSON(URLS.episodeServers(episodeId));
  const html = data.html || "";
  const $ = cheerio.load(html);

  const parse = (selector) => {
    const list = [];
    $(selector).each((_, el) => list.push(formatServer($(el), $)));
    return list;
  };

  return {
    episodeId,
    sub: parse(".ps_-block.ps_-block-sub .server-item"),
    dub: parse(".ps_-block.ps_-block-dub .server-item"),
    raw: parse(".ps_-block.ps_-block-raw .server-item"),
  };
}

// ── Episode Sources ───────────────────────────────────────────────────────────

export async function scrapeEpisodeSources(serverId) {
  const data = await fetchJSON(URLS.episodeSources(serverId));
  return {
    serverId,
    type:   data.type   || null,
    server: data.server || null,
    link:   data.link   || null,
  };
}

// ── Category ──────────────────────────────────────────────────────────────────

export async function scrapeCategory(category, page = 1) {
  const html = await fetchPage(URLS.category(category, page));
  const $ = cheerio.load(html);
  const animes = [];
  $(".flw-item").each((_, el) => animes.push(formatFilmCard($(el), $)));
  return { category, page, totalPages: parseTotalPages($), animes };
}

// ── Genre ─────────────────────────────────────────────────────────────────────

export async function scrapeGenre(genre, page = 1) {
  const html = await fetchPage(URLS.genre(genre, page));
  const $ = cheerio.load(html);
  const animes = [];
  $(".flw-item").each((_, el) => animes.push(formatFilmCard($(el), $)));
  return { genre, page, totalPages: parseTotalPages($), animes };
}

// ── Producer ──────────────────────────────────────────────────────────────────

export async function scrapeProducer(producer, page = 1) {
  const html = await fetchPage(URLS.producer(producer, page));
  const $ = cheerio.load(html);
  const animes = [];
  $(".flw-item").each((_, el) => animes.push(formatFilmCard($(el), $)));
  return { producer, page, totalPages: parseTotalPages($), animes };
}

// ── AZ List ───────────────────────────────────────────────────────────────────

export async function scrapeAZList(sortOption = "all", page = 1) {
  const html = await fetchPage(URLS.azList(sortOption, page));
  const $ = cheerio.load(html);
  const animes = [];
  $(".flw-item").each((_, el) => animes.push(formatFilmCard($(el), $)));
  return { sortOption, page, totalPages: parseTotalPages($), animes };
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export async function scrapeSchedule(date) {
  const data = await fetchJSON(URLS.schedule(date));
  const html = data.html || "";
  const $ = cheerio.load(html);

  const scheduled = [];
  $(".ssl-item, li[data-id]").each((_, el) => {
    scheduled.push({
      id:       $(el).attr("data-id") || null,
      name:     clean($(el).find(".film-name, .name").text()),
      time:     clean($(el).find(".time, .ani-detail").text()),
      airingAt: $(el).attr("data-airing-at") || null,
    });
  });

  return { date, scheduled };
}

// ── Qtip ─────────────────────────────────────────────────────────────────────

export async function scrapeQtip(animeId) {
  const data = await fetchJSON(URLS.qtip(animeId));
  const html = data.html || "";
  const $ = cheerio.load(html);

  return {
    animeId,
    name:    clean($(".film-name, .d-title").first().text()),
    poster:  $("img").first().attr("src") || $("img").first().attr("data-src") || null,
    type:    clean($(".fdi-item").first().text()),
    episodes: {
      sub: parseInt($(".tick-sub").text(), 10) || null,
      dub: parseInt($(".tick-dub").text(), 10) || null,
    },
    score: clean($(".score").text()) || null,
  };
}
