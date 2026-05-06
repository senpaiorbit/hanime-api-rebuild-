// providers/anikoto/parser.js
import { load, text, attr, each, num } from '../../utils/dom.js';

// ─── Pagination helpers ──────────────────────────────────────────────
function getLastPage($) {
  const lastHref = $('nav .pagination li:last-child a.page-link').attr('href');
  if (lastHref) {
    const m = lastHref.match(/page=(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  let max = 1;
  $('nav .pagination .page-item .page-link').each((_, el) => {
    const n = parseInt($(el).text().trim(), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max;
}

function getCurrentPage($) {
  return num($('nav .pagination .page-item.active .page-link').text().trim()) || 1;
}

// ─── Clean up ID from href ──────────────────────────────────────────
function extractId(href) {
  if (!href) return null;
  const cleaned = href
    .replace(/^https?:\/\/[^\/]+\/watch\//, '')
    .replace(/^\/watch\//, '')
    .replace(/\/ep-\d+.*$/, '')
    .replace(/^\//, '')
    .trim();
  return cleaned || null;
}

// ─── Extract numeric tip (data-tip) ─────────────────────────────────
function extractTipId($, el) {
  const tip = $(el).find('.ani.poster').attr('data-tip') ||
              $(el).find('[data-tip]').first().attr('data-tip');
  return tip || null;
}

// ─── Genre list from nav menu ───────────────────────────────────────
function parseGenreList($) {
  return each($, '#menu ul li ul.c4 li a', el => {
    const title = el.attr('title') || el.find('h3').text().trim();
    return title;
  }).filter(Boolean);
}

// ─── Episode extraction from item cards ────────────────────────────
function parseEpisodes($, ctx) {
  const subText = $(ctx).find('.ep-status.sub span').text().trim();
  const dubText = $(ctx).find('.ep-status.dub span').text().trim();
  return {
    sub: subText ? (parseInt(subText, 10) || 1) : null,
    dub: dubText ? (parseInt(dubText, 10) || 1) : null,
  };
}

// ─── Parse anime card from list pages ──────────────────────────────
function parseAitem($, el) {
  const posterLink = $(el).find('.ani.poster a, a.poster').first();
  const href = posterLink.attr('href') || $(el).find('a').first().attr('href');
  const id = extractId(href);
  const tipId = extractTipId($, el);
  
  const nameEl = $(el).find('.name.d-title');
  const name = nameEl.attr('data-jp') || nameEl.text().trim() || '';
  const jname = nameEl.attr('data-jp') || null;
  const poster = $(el).find('img').attr('src');
  const eps = parseEpisodes($, el);
  
  let type = null;
  const typeEl = $(el).find('.meta .right').first();
  if (typeEl.length) type = typeEl.text().trim() || null;
  
  return { id, tipId, name, jname, poster, type, episodes: eps };
}

// ─── Navigation helpers ────────────────────────────────────────────
const TYPE_SLUGS = new Set(['movie', 'tv', 'ova', 'ona', 'special', 'music']);

function toApiUrl(siteHref, providerName) {
  if (!siteHref || siteHref === 'javascript:;') return null;
  const base = `/api/v2/${providerName}`;
  
  const genreMatch = siteHref.match(/^\/genre\/(.+)$/);
  if (genreMatch) return `${base}/genre/${genreMatch[1]}`;
  
  const azMatch = siteHref.match(/^\/az-list\/?(.*)$/);
  if (azMatch !== null) {
    return azMatch[1] ? `${base}/azlist/${azMatch[1]}` : `${base}/azlist`;
  }
  
  const watchMatch = siteHref.match(/\/watch\/(.+)$/);
  if (watchMatch) {
    const slug = extractId(watchMatch[0]);
    return `${base}/anime/${slug}`;
  }
  
  const slug = siteHref.replace(/^\//, '');
  
  if (slug.startsWith('type/')) return `${base}/type/${slug.replace('type/', '')}`;
  if (TYPE_SLUGS.has(slug)) return `${base}/type/${slug}`;
  if (slug === 'filter') return `${base}/search`;
  if (slug === 'random') return `/api/v2/${providerName}/random`;
  if (slug === 'home') return `${base}/home`;
  if (slug === 'latest-updated') return `${base}/category/latest-updated`;
  if (slug === 'new-release') return `${base}/category/new-release`;
  if (slug === 'most-viewed') return `${base}/category/most-viewed`;
  if (slug.startsWith('status/')) return `${base}/category/${slug}`;
  
  return siteHref;
}

// ─── Utility: safe text extraction ─────────────────────────────────
function detailValue($, baseSelector, label) {
  let result = null;
  $(baseSelector).find('div').each((_, div) => {
    const raw = $(div).text().trim();
    if (raw.startsWith(label)) {
      const span = $(div).find('> span');
      if (span.length) {
        result = span.text().trim() || null;
      } else {
        result = raw.replace(label, '').trim() || null;
      }
      return false;
    }
  });
  return result;
}

function detailLinks($, baseSelector, label) {
  let result = [];
  $(baseSelector).find('div').each((_, div) => {
    if ($(div).text().trim().startsWith(label)) {
      $(div).find('a').each((_, a) => {
        const val = $(a).find('span').text().trim() || $(a).text().trim();
        if (val && val !== 'unknown') result.push(val);
      });
      return false;
    }
  });
  return result;
}

// ─── Exported parsers ──────────────────────────────────────────────

export function parseNavMenu(html, providerName = 'anikoto') {
  const $ = load(html);
  
  const genres = each($, '#menu ul li ul.c4 li a', (el) => ({
    name: (el.attr('title') || el.find('h3').text() || '').trim(),
    url: toApiUrl(el.attr('href'), providerName),
  })).filter(g => g.name);
  
  const types = each($, '#menu ul li ul.c1 li a', (el) => ({
    name: (el.attr('title') || el.find('h3').text() || '').trim(),
    url: toApiUrl(el.attr('href'), providerName),
  })).filter(t => t.name);
  
  const links = [];
  $('#menu > ul > li > a').each((_, a) => {
    const href = $(a).attr('href');
    const name = $(a).clone().find('i, ul, h3').remove().end().text().trim();
    if (href && href !== 'javascript:;' && name && name !== 'Genre' && name !== 'Types') {
      links.push({ name, url: toApiUrl(href, providerName) });
    }
  });
  
  const brand = {
    link: $('header .logo a').attr('href') || '/home',
    logo: $('header .logo img').attr('src') || null,
  };
  
  return {
    brand,
    buttons: { menu: true, search: true, watch2gether: null, random: '/random' },
    search: {
      action: `/api/v2/${providerName}/search`,
      placeholder: $('header input[name="keyword"]').attr('placeholder') || 'Search anime...',
      filter_link: `/api/v2/${providerName}/search`,
    },
    menu: { genres, types, links },
    browse: {
      url: `/api/v2/${providerName}/search`,
      sortOptions: [
        { label: 'Default', value: 'default' },
        { label: 'Latest Updated', value: 'latest-updated' },
        { label: 'Latest Added', value: 'latest-added' },
        { label: 'Score', value: 'score' },
        { label: 'Name A-Z', value: 'name-az' },
        { label: 'Release Date', value: 'release-date' },
        { label: 'Most Viewed', value: 'most-viewed' },
        { label: 'Number of episodes', value: 'number_of_episodes' },
      ],
      filters: {
        type: ['Movie', 'Music', 'ONA', 'OVA', 'Special', 'TV'],
        status: ['finished-airing', 'currently-airing', 'not-yet-aired'],
        season: ['fall', 'summer', 'spring', 'winter'],
        rating: ['PG', 'PG-13', 'G', 'R', 'R+', 'Rx'],
        language: ['sub', 'dub'],
      },
    },
    language: ['en', 'jp'],
  };
}

export function parseHome(html) {
  const $ = load(html);
  const genres = parseGenreList($);
  
  const spotlightAnimes = each($, '#hotest .swiper-wrapper .swiper-slide.item', (el, i) => {
    const href = $(el).find('a.btn.play').attr('href');
    return {
      id: extractId(href),
      name: $(el).find('.title.d-title').text().trim() || null,
      jname: $(el).find('.title.d-title').attr('data-jp') || null,
      poster: $(el).find('.image div').attr('style')?.match(/url\(['"]?([^)'"]+)['"]?\)/)?.[1] || null,
      description: $(el).find('.synopsis').text().trim() || null,
      rating: $(el).find('.meta i.rating').text().trim() || null,
      rank: i + 1,
      otherInfo: [
        $(el).find('.meta i.quality').text().trim(),
        $(el).find('.meta i.date').text().trim(),
      ].filter(Boolean),
      genres: [],
      episodes: {
        sub: $(el).find('.meta i.sub').length ? 1 : null,
        dub: $(el).find('.meta i.dub').length ? 1 : null,
      },
    };
  });
  
  const latestEpisodeAnimes = each($, '#recent-update .ani.items .item', (el) => {
    const href = $(el).find('.ani.poster a').attr('href');
    return {
      id: extractId(href),
      tipId: extractTipId($, el),
      name: $(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text().trim() || null,
      jname: $(el).find('.name.d-title').attr('data-jp') || null,
      poster: $(el).find('img').attr('src'),
      type: $(el).find('.meta .right').first().text().trim() || null,
      episodes: parseEpisodes($, el),
    };
  });
  
  const newReleases = each($, '.top-tables section[data-name="new-release"] .scaff.items a.item', (el) => {
    const href = el.attr('href');
    return {
      id: extractId(href),
      name: $(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text().trim() || null,
      jname: $(el).find('.name.d-title').attr('data-jp') || null,
      poster: $(el).find('img').attr('src'),
      type: null,
      episodes: parseEpisodes($, el),
    };
  });
  
  const topUpcomingAnimes = each($, '.top-tables section[data-name="new-added"] .scaff.items a.item', (el) => {
    const href = el.attr('href');
    return {
      id: extractId(href),
      name: $(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text().trim() || null,
      jname: $(el).find('.name.d-title').attr('data-jp') || null,
      poster: $(el).find('img').attr('src'),
      type: null,
      episodes: parseEpisodes($, el),
    };
  });
  
  const today = each($, '.tab-content[data-name="day"] .scaff.side.items a.item', (el) => {
    const href = el.attr('href');
    const rankClass = el.attr('class')?.match(/rank(\d+)/)?.[1];
    return {
      id: extractId(href),
      rank: rankClass ? parseInt(rankClass, 10) : num($(el).find('.rank').text().trim()),
      name: $(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text().trim() || null,
      jname: $(el).find('.name.d-title').attr('data-jp') || null,
      poster: $(el).find('img').attr('src'),
      episodes: parseEpisodes($, el),
    };
  });
  
  const week = each($, '.tab-content[data-name="week"] .scaff.side.items a.item', (el) => {
    const href = el.attr('href');
    return {
      id: extractId(href),
      rank: num($(el).find('.rank').text().trim()),
      name: $(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text().trim() || null,
      jname: $(el).find('.name.d-title').attr('data-jp') || null,
      poster: $(el).find('img').attr('src'),
      episodes: parseEpisodes($, el),
    };
  });
  
  const month = each($, '.tab-content[data-name="month"] .scaff.side.items a.item', (el) => {
    const href = el.attr('href');
    return {
      id: extractId(href),
      rank: num($(el).find('.rank').text().trim()),
      name: $(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text().trim() || null,
      jname: $(el).find('.name.d-title').attr('data-jp') || null,
      poster: $(el).find('img').attr('src'),
      episodes: parseEpisodes($, el),
    };
  });
  
  return {
    genres,
    spotlightAnimes,
    latestEpisodeAnimes,
    newReleases,
    topUpcomingAnimes,
    top10Animes: { today, day: [], week, month },
  };
}

export function parseIndex(html) {
  const $ = load(html);
  return {
    meta: {
      title: $('title').text().trim() || null,
      description: $('meta[name="description"]').attr('content') || null,
      ogImage: $('meta[property="og:image"]').attr('content') || null,
      canonical: $('link[rel="canonical"]').attr('href') || null,
    },
    mostSearched: each($, '.search-term a.item', el => ({
      label: el.text().trim().replace(/,?\s*$/, ''),
      keyword: el.text().trim().replace(/,?\s*$/, ''),
    })),
    genres: parseGenreList($),
    azList: each($, 'footer .azlist ul li a', el => ({
      label: el.text().trim(),
      href: el.attr('href') || null,
    })).filter(a => a.label),
    footerMenu: each($, 'footer .inline-links ul li a', el => ({
      label: $(el).find('span').text().trim() || el.text().trim(),
      href: el.attr('href') || null,
    })).filter(m => m.label),
  };
}

export function parseSearchFromHtml(html) {
  const $ = load(html);
  const animes = each($, '#list-items .item', el => parseAitem($, el));
  const cur = getCurrentPage($);
  const last = getLastPage($);
  return { animes, currentPage: cur, totalPages: last, hasNextPage: cur < last, totalCount: null };
}

export function parseAzListFromHtml(html) {
  const $ = load(html);
  const animes = each($, '#list-items .item, .items .item', el => parseAitem($, el));
  const cur = getCurrentPage($);
  const last = getLastPage($);
  return { sortOption: 'all', animes, currentPage: cur, totalPages: last, hasNextPage: cur < last };
}

export function parseListPage(html) {
  const $ = load(html);
  const title = $('.head .title').first().text().trim() || null;
  const animes = each($, '#list-items .item, .items .item', el => parseAitem($, el));
  const cur = getCurrentPage($);
  const last = getLastPage($);
  return { title, animes, currentPage: cur, totalPages: last, hasNextPage: cur < last };
}

// ─── Full Anime Detail from Watch Page HTML ────────────────────────
export function parseAnime(html) {
  const $ = load(html);
  
  const animeId = $('#watch-main').attr('data-id') || null;
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const dataUrl = $('#watch-main').attr('data-url') || '';
  const slugFromUrl = extractId(dataUrl || canonical);
  
  const name = text($, 'h1.title.d-title') || $('meta[property="og:title"]').attr('content')?.replace('Watch ', '').replace(/ Episode \d+.*$/, '').trim() || null;
  const jname = attr($, 'h1.title.d-title', 'data-jp');
  const poster = attr($, '.poster img[itemprop="image"]', 'src') || $('meta[property="og:image"]').attr('content') || null;
  
  // Synonyms
  const synonymsRaw = text($, '.binfo .info .names');
  const synonyms = synonymsRaw ? synonymsRaw.split(';').map(s => s.trim()).filter(Boolean)[0] || null : null;
  
  // Description
  const description = text($, '.synopsis .shorting .content') || $('meta[property="og:description"]').attr('content') || null;
  
  // Rating
  const rating = text($, '.meta i.rating');
  
  // Sub/Dub
  const hasSub = $('.meta i.sub').length > 0;
  const hasDub = $('.meta i.dub').length > 0;
  
  // Detail fields
  const firstMetaDiv = '.bmeta .meta:first-child';
  const lastMetaDiv = '.bmeta .meta:last-child';
  
  const type = detailValue($, firstMetaDiv, 'Type:');
  const premiered = detailLinks($, firstMetaDiv, 'Premiered:')[0] || detailValue($, firstMetaDiv, 'Premiered:');
  const aired = detailValue($, firstMetaDiv, 'Aired:');
  const status = detailLinks($, firstMetaDiv, 'Status:')[0] || detailValue($, firstMetaDiv, 'Status:');
  const genres = detailLinks($, firstMetaDiv, 'Genres:');
  
  const score = detailValue($, lastMetaDiv, 'MAL:');
  const duration = detailValue($, lastMetaDiv, 'Duration:');
  const episodesRaw = detailValue($, lastMetaDiv, 'Episodes:');
  const episodesTotal = episodesRaw === '?' ? null : parseInt(episodesRaw, 10) || null;
  const studios = detailLinks($, lastMetaDiv, 'Studios:');
  const producers = detailLinks($, lastMetaDiv, 'Producers:');
  
  // MAL ID from script
  let malId = null;
  $('script').each((_, el) => {
    const script = $(el).html();
    if (script && script.includes('mangaId')) {
      const match = script.match(/const\s+mangaId\s*=\s*(\d+)/);
      if (match) malId = match[1];
    }
  });
  
  // ─── Related (from #watch-order section) ─────────────────────────
  // This is the actual related/watch-order section, AJAX-loaded
  // We can try to scrape it but it's injected via JS. Skip if empty.
  const related = [];
  
  // ─── Recommended (from last sidebar section) ─────────────────────
  const recommended = each($, '.sidebar > section.w-side-section:last-child .scaff.side.items a.item', (el) => {
    const href = el.attr('href');
    const typeText = $(el).find('.meta span.dot').eq(0).text().trim();
    const epsText = $(el).find('.meta span.dot').eq(1).text().trim();
    const yearText = $(el).find('.meta span.dot').eq(2).text().trim();
    return {
      id: extractId(href),
      name: $(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text().trim() || null,
      jname: $(el).find('.name.d-title').attr('data-jp') || null,
      poster: $(el).find('img').attr('src'),
      type: typeText || null,
      duration: null,
      episodes: {
        sub: parseInt(epsText, 10) || null,
        dub: null,
      },
      year: parseInt(yearText, 10) || null,
    };
  });
  
  return {
    anime: {
      id: slugFromUrl || animeId,
      animeId,
      name,
      jname,
      synonyms,
      japanese: jname,
      poster,
      description,
      type,
      rating,
      episodes: {
        sub: hasSub ? 1 : null,
        dub: hasDub ? 1 : null,
      },
      duration,
      premiered,
      aired,
      broadcast: null,
      status,
      score,
      episodesTotal,
      country: null,
      genres,
      studios,
      producers,
      malId,
      alId: null,
    },
    related,
    recommended,
    seasons: [],
  };
}

// ─── JSON API parsers ──────────────────────────────────────────────

export function parseAnimeFromJson(data) {
  if (!data.ok) throw new Error('Invalid JSON API response');
  const d = data.data.anime;
  return {
    anime: {
      id: String(d.id),
      animeId: String(d.id),
      name: d.title,
      jname: d.native || null,
      synonyms: d.alternative || null,
      japanese: d.native || null,
      poster: d.poster,
      description: d.description?.replace(/<[^>]+>/g, '') || null,
      type: d.terms_by_type?.type?.[0] || null,
      rating: d.rating || null,
      episodes: { sub: d.is_sub || null, dub: d.is_dub || null },
      duration: d.duration || null,
      premiered: null,
      aired: d.aired || null,
      broadcast: null,
      status: d.status || null,
      score: null,
      episodesTotal: parseInt(d.episodes, 10) || null,
      country: null,
      genres: d.terms_by_type?.genre || [],
      studios: d.terms_by_type?.studios || [],
      producers: d.terms_by_type?.producers || [],
      malId: d.mal_id || null,
      alId: d.ani_id || null,
    },
    related: [],
    recommended: [],
    seasons: [],
  };
}

export function parseEpisodesFromJson(data) {
  if (!data.ok) throw new Error('Invalid JSON API response');
  const d = data.data;
  const anime = d.anime;
  const episodesList = d.episodes || [];
  return {
    totalEpisodes: episodesList.length,
    malId: anime.mal_id || null,
    alId: anime.ani_id || null,
    episodes: episodesList.map(ep => ({
      number: ep.number,
      title: ep.title || `${anime.title} - Episode ${ep.number}`,
      isFiller: false,
      hasSub: !!ep.embed_url?.sub,
      hasDub: !!ep.embed_url?.dub,
      sources: {
        ...(ep.embed_url?.sub ? { sub: ep.embed_url.sub } : {}),
        ...(ep.embed_url?.dub ? { dub: ep.embed_url.dub } : {}),
      },
    })),
  };
}

// ─── Merge function: JSON API + HTML scraper ──────────────────────
// Priority: JSON API for structured data (IDs, episodes, genres, studios, producers)
//           HTML scraper for display data (description, score, synonyms, type, aired, duration)
export function mergeAnimeData(jsonResult, htmlResult) {
  const jsonAnime = jsonResult?.anime || {};
  const htmlAnime = htmlResult?.anime || {};

  // Helper: pick first truthy value
  const pick = (jsonVal, htmlVal, fallback = null) => {
    if (jsonVal && jsonVal !== 'unknown' && !(Array.isArray(jsonVal) && jsonVal.length === 1 && jsonVal[0] === 'unknown')) return jsonVal;
    if (htmlVal && htmlVal !== 'unknown' && !(Array.isArray(htmlVal) && htmlVal.length === 1 && htmlVal[0] === 'unknown')) return htmlVal;
    return fallback;
  };

  // Helper: pick the better array
  const pickArray = (jsonArr, htmlArr) => {
    const jArr = (jsonArr || []).filter(v => v && v !== 'unknown');
    const hArr = (htmlArr || []).filter(v => v && v !== 'unknown');
    return jArr.length > 0 ? jArr : (hArr.length > 0 ? hArr : []);
  };

  const mergedAnime = {
    id: pick(jsonAnime.id, htmlAnime.id),
    animeId: pick(jsonAnime.animeId, htmlAnime.animeId),
    name: pick(jsonAnime.name, htmlAnime.name),
    jname: pick(jsonAnime.jname, htmlAnime.jname),
    synonyms: pick(jsonAnime.synonyms, htmlAnime.synonyms),
    japanese: pick(jsonAnime.japanese, htmlAnime.japanese),
    poster: pick(jsonAnime.poster, htmlAnime.poster),
    description: pick(htmlAnime.description, jsonAnime.description),  // HTML description is usually richer
    type: pick(htmlAnime.type, jsonAnime.type),
    rating: pick(htmlAnime.rating, jsonAnime.rating),
    episodes: {
      sub: pick(jsonAnime.episodes?.sub, htmlAnime.episodes?.sub),
      dub: pick(jsonAnime.episodes?.dub, htmlAnime.episodes?.dub),
    },
    duration: pick(htmlAnime.duration, jsonAnime.duration),
    premiered: pick(htmlAnime.premiered, jsonAnime.premiered),
    aired: pick(htmlAnime.aired, jsonAnime.aired),
    broadcast: pick(jsonAnime.broadcast, htmlAnime.broadcast),
    status: pick(htmlAnime.status, jsonAnime.status),
    score: pick(htmlAnime.score, jsonAnime.score),
    episodesTotal: pick(jsonAnime.episodesTotal, htmlAnime.episodesTotal),
    country: pick(jsonAnime.country, htmlAnime.country),
    genres: pickArray(jsonAnime.genres, htmlAnime.genres),
    studios: pickArray(jsonAnime.studios, htmlAnime.studios),
    producers: pickArray(jsonAnime.producers, htmlAnime.producers),
    malId: pick(jsonAnime.malId, htmlAnime.malId),
    alId: pick(jsonAnime.alId, htmlAnime.alId),
  };

  // Combine related/recommended, remove duplicates
  const jsonRelated = jsonResult?.related || [];
  const htmlRelated = htmlResult?.related || [];
  const jsonRecommended = jsonResult?.recommended || [];
  const htmlRecommended = htmlResult?.recommended || [];

  const seen = new Set();
  const dedupe = (items) => items.filter(item => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  const related = dedupe([...jsonRelated, ...htmlRelated]);
  const recommended = dedupe([...jsonRecommended, ...htmlRecommended]);

  return {
    anime: mergedAnime,
    related,
    recommended,
    seasons: jsonResult?.seasons || htmlResult?.seasons || [],
  };
}
