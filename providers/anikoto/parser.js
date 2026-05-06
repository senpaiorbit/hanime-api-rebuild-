// providers/anikoto/parser.js
import { load, text, attr, each, num } from '../../utils/dom.js';

// ─── Pagination helpers ────────────────────────────────────────────────
function getLastPage($) {
  // Look for pagination in this structure:
  // <nav class="navigation"><ul class="pagination">...
  const lastHref = $('nav .pagination li:last-child a.page-link').attr('href') ||
                   $('nav .pagination .page-item:last-child a').attr('href');
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

// ─── Genre list from nav menu ──────────────────────────────────────────
function parseGenreList($) {
  // From home.html: #menu ul li ul.c4 li a h3
  return each($, '#menu ul li ul.c4 li a h3', el => el.text().trim()).filter(Boolean);
}

// ─── Episode parsing from item cards ───────────────────────────────────
function parseEpisodes($, ctx) {
  const subEl = $(ctx).find('.ep-status.sub span');
  const dubEl = $(ctx).find('.ep-status.dub span');
  
  return {
    sub: subEl.length ? (num(subEl.text().trim()) || 1) : null,
    dub: dubEl.length ? (num(dubEl.text().trim()) || 1) : null,
  };
}

// ─── Parse anime item from list cards ──────────────────────────────────
function parseAitem($, el) {
  // From filter.sreach.type.genre.html:
  // .item > .inner > .ani.poster > a[href] > img[src]
  const posterLink = $(el).find('.ani.poster a, a.poster').first();
  const href = posterLink.attr('href') || $(el).find('a').first().attr('href');
  
  // Extract ID: /watch/some-slug-6oxiz -> some-slug-6oxiz
  // Also handle /watch/some-slug/ep-1 -> some-slug
  let id = null;
  if (href) {
    id = href.replace('/watch/', '').replace(/\/ep-\d+.*$/, '').replace(/^\//, '').trim();
  }
  
  const nameEl = $(el).find('.name.d-title');
  const name = nameEl.attr('data-jp') || nameEl.text().trim();
  const jname = nameEl.attr('data-jp') || null;
  const poster = $(el).find('img').attr('src');
  const eps = parseEpisodes($, el);
  
  // Type from .meta .right or .m-item label
  let type = null;
  const typeEl = $(el).find('.meta .right, .meta .m-item label').first();
  if (typeEl.length) {
    const t = typeEl.text().trim();
    if (t && isNaN(parseInt(t, 10)) && !['Sub', 'Dub'].includes(t)) type = t;
  }
  
  return { id, name, jname, poster, type, episodes: eps };
}

// ─── Navigation Menu ───────────────────────────────────────────────────
const TYPE_SLUGS = new Set(['movie', 'tv', 'ova', 'ona', 'special', 'music']);
const CATEGORY_SLUGS = new Set([
  'new-release', 'latest-updated', 'most-viewed',
  'status/not-yet-aired', 'status/currently-airing', 'status/finished-airing',
]);

function toApiUrl(siteHref, providerName) {
  if (!siteHref || siteHref === 'javascript:;') return null;
  
  const base = `/api/v2/${providerName}`;
  
  // /genre/action -> /api/v2/{p}/genre/action
  const genreMatch = siteHref.match(/^\/genre\/(.+)$/);
  if (genreMatch) return `${base}/genre/${genreMatch[1]}`;
  
  // /az-list or /az-list/A
  const azMatch = siteHref.match(/^\/az-list\/?(.*)$/);
  if (azMatch !== null) {
    return azMatch[1] ? `${base}/azlist/${azMatch[1]}` : `${base}/azlist`;
  }
  
  // /watch/some-id
  const watchMatch = siteHref.match(/^\/watch\/(.+)$/);
  if (watchMatch) {
    const slug = watchMatch[1].split('/ep-')[0];
    return `${base}/anime/${slug}`;
  }
  
  const slug = siteHref.replace(/^\//, '');
  
  // /type/movie -> /api/v2/{p}/type/movie
  if (slug.startsWith('type/')) return `${base}/type/${slug.replace('type/', '')}`;
  if (TYPE_SLUGS.has(slug)) return `${base}/type/${slug}`;
  
  // /status/currently-airing etc.
  if (slug.startsWith('status/')) return `${base}/category/${slug}`;
  if (CATEGORY_SLUGS.has(slug)) return `${base}/category/${slug}`;
  
  // /filter -> search
  if (slug === 'filter') return `${base}/search`;
  if (slug === 'random') return `/api/v2/${providerName}/random`;
  if (slug === 'home') return `${base}/home`;
  
  return siteHref;
}

export function parseNavMenu(html, providerName = 'anikoto') {
  const $ = load(html);
  
  // Genres from the dropdown menu
  const genres = each($, '#menu ul li ul.c4 li a', (el) => ({
    name: ($(el).find('h3').text() || $(el).attr('title') || '').trim(),
    url: toApiUrl(el.attr('href'), providerName),
  })).filter(g => g.name);
  
  // Types from the dropdown menu
  const types = each($, '#menu ul li ul.c1 li a', (el) => ({
    name: ($(el).find('h3').text() || $(el).attr('title') || '').trim(),
    url: toApiUrl(el.attr('href'), providerName),
  })).filter(t => t.name);
  
  // Direct links
  const links = [];
  $('#menu > ul > li > a').each((_, a) => {
    const href = $(a).attr('href');
    // Skip the Genre and Types dropdown parents (they have no href)
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
        country: [
          { label: 'China', value: '2' },
          { label: 'Japan', value: '11' }
        ],
        language: ['sub', 'dub'],
      },
    },
    language: ['en', 'jp'],
  };
}

// ─── Home Page ─────────────────────────────────────────────────────────
export function parseHome(html) {
  const $ = load(html);
  
  const genres = parseGenreList($);
  
  // Spotlight from swiper (#hotest)
  const spotlightAnimes = each($, '#hotest .swiper-slide .item', (el, i) => {
    const href = $(el).find('a.btn.play').attr('href');
    return {
      id: href ? href.replace('/watch/', '').trim() : null,
      name: text($, '.title.d-title, h2.title', el),
      jname: attr($, '.title.d-title', 'data-jp', el),
      poster: $(el).find('.image div').attr('style')?.match(/url\(([^)]+)\)/)?.[1] || null,
      description: text($, '.synopsis', el),
      rating: text($, '.meta .rating, .meta i.rating', el),
      rank: i + 1,
      otherInfo: [],
      genres: [],
      episodes: parseEpisodes($, el),
    };
  });
  
  // Latest episodes from #recent-update
  const latestEpisodeAnimes = each($, '#recent-update .ani.items .item', (el) => {
    const href = $(el).find('.ani.poster a').attr('href');
    return {
      id: href ? href.replace('/watch/', '').split('/ep-')[0].trim() : null,
      name: text($, '.name.d-title', el),
      jname: attr($, '.name.d-title', 'data-jp', el),
      poster: $(el).find('img').attr('src'),
      type: null,
      episodes: parseEpisodes($, el),
    };
  });
  
  // Top anime from sidebar
  const top10Animes = {
    today: each($, '.scaff.side.items a.item', (el) => ({
      id: $(el).attr('href')?.replace('/watch/', '') || null,
      rank: num($(el).find('.rank').text().trim()),
      name: text($, '.name.d-title', el),
      poster: $(el).find('img').attr('src'),
      episodes: parseEpisodes($, el),
    })),
    day: [],
    week: [],
    month: [],
  };
  
  return {
    genres,
    spotlightAnimes,
    latestEpisodeAnimes,
    newReleases: [],
    topUpcomingAnimes: [],
    top10Animes,
  };
}

// ─── Index Page ────────────────────────────────────────────────────────
export function parseIndex(html) {
  const $ = load(html);
  
  const title = $('title').text().trim() || null;
  const description = $('meta[name="description"]').attr('content') || null;
  const ogImage = $('meta[property="og:image"]').attr('content') || null;
  const canonical = $('link[rel="canonical"]').attr('href') || null;
  
  const mostSearched = each($, '.search-term a.item', (el) => ({
    label: el.text().trim().replace(/,?\s*$/, ''),
    keyword: el.text().trim().replace(/,?\s*$/, ''),
  }));
  
  const genres = parseGenreList($);
  
  const azList = each($, 'footer .azlist ul li a', (el) => ({
    label: el.text().trim(),
    href: el.attr('href') || null,
  })).filter(a => a.label);
  
  const footerMenu = each($, 'footer .inline-links ul li a', (el) => ({
    label: $(el).find('span').text().trim() || el.text().trim(),
    href: el.attr('href') || null,
  })).filter(m => m.label);
  
  return {
    meta: { title, description, ogImage, canonical },
    mostSearched,
    genres,
    azList,
    footerMenu,
  };
}

// ─── Search / Browse / Filter pages ────────────────────────────────────
export function parseSearchFromHtml(html) {
  const $ = load(html);
  
  // From filter.sreach.type.genre.html:
  // Items are in #list-items .item
  const animes = each($, '#list-items .item', (el) => parseAitem($, el));
  
  const cur = getCurrentPage($);
  const last = getLastPage($);
  
  return {
    animes,
    currentPage: cur,
    totalPages: last,
    hasNextPage: cur < last,
    totalCount: animes.length > 0 ? null : 0,
  };
}

// ─── A-Z List ──────────────────────────────────────────────────────────
export function parseAzListFromHtml(html) {
  const $ = load(html);
  
  // Same structure as filter page
  const animes = each($, '#list-items .item, .items .item', (el) => parseAitem($, el));
  const cur = getCurrentPage($);
  const last = getLastPage($);
  
  return {
    sortOption: 'all',
    animes,
    currentPage: cur,
    totalPages: last,
    hasNextPage: cur < last,
  };
}

// ─── Generic list page (genre, category, type) ─────────────────────────
export function parseListPage(html) {
  const $ = load(html);
  
  const title = $('.head .title').first().text().trim() || null;
  const animes = each($, '#list-items .item, .items .item', (el) => parseAitem($, el));
  const cur = getCurrentPage($);
  const last = getLastPage($);
  
  return {
    title,
    animes,
    currentPage: cur,
    totalPages: last,
    hasNextPage: cur < last,
  };
}

// ─── Anime Detail from HTML ────────────────────────────────────────────
export function parseAnime(html) {
  const $ = load(html);
  
  let id = null;
  const canonical = $('link[rel="canonical"]').attr('href');
  if (canonical) {
    id = canonical.replace(/^https?:\/\/[^\/]+\/watch\//, '').replace(/\/ep-\d+$/, '').trim();
  }
  
  const name = $('meta[property="og:title"]').attr('content') || text($, 'h1.title');
  const poster = $('meta[property="og:image"]').attr('content') || null;
  const description = $('meta[property="og:description"]').attr('content') || 
                      text($, '.description, .synopsis, .desc');
  
  return {
    anime: {
      id,
      animeId: id,
      name,
      jname: name,
      synonyms: name,
      japanese: name,
      poster,
      description,
      type: null,
      rating: null,
      episodes: { sub: null, dub: null },
      duration: null,
      premiered: null,
      aired: null,
      broadcast: null,
      status: null,
      score: null,
      episodesTotal: null,
      country: null,
      genres: [],
      studios: [],
      producers: [],
      malId: null,
      alId: null,
    },
    related: [],
    recommended: [],
    seasons: [],
  };
}

// ─── Anime Detail from JSON API ────────────────────────────────────────
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
      description: d.description,
      type: d.terms_by_type?.type?.[0] || null,
      rating: d.rating || null,
      episodes: {
        sub: d.is_sub || 0,
        dub: d.is_dub || 0,
      },
      duration: d.duration,
      premiered: null,
      aired: d.aired,
      broadcast: null,
      status: d.status,
      score: null,
      episodesTotal: parseInt(d.episodes, 10) || 0,
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

// ─── Episodes from JSON API ────────────────────────────────────────────
export function parseEpisodesFromJson(data) {
  if (!data.ok) throw new Error('Invalid JSON API response');
  
  const d = data.data;
  const anime = d.anime;
  const episodesList = d.episodes || [];
  
  const total = episodesList.length;
  const malId = anime.mal_id || null;
  const alId = anime.ani_id || null;
  const name = anime.title;
  
  const episodes = episodesList.map(ep => ({
    number: ep.number,
    title: ep.title || `${name} - Episode ${ep.number}`,
    isFiller: false,
    hasSub: !!ep.embed_url?.sub,
    hasDub: !!ep.embed_url?.dub,
    sources: {
      ...(ep.embed_url?.sub ? { sub: ep.embed_url.sub } : {}),
      ...(ep.embed_url?.dub ? { dub: ep.embed_url.dub } : {}),
    },
  }));
  
  return {
    totalEpisodes: total,
    malId,
    alId,
    episodes,
  };
}
