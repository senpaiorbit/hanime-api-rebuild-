// providers/anikoto/parser.js
import { load, text, attr, each, num } from '../../utils/dom.js';

// ═══════════════════════════════════════════════════════════════════
// PAGINATION HELPERS
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// ID EXTRACTION
// ═══════════════════════════════════════════════════════════════════

function extractId(href) {
  if (!href) return null;
  return href
    .replace(/^https?:\/\/[^\/]+\/watch\//, '')
    .replace(/^\/watch\//, '')
    .replace(/\/ep-\d+.*$/, '')
    .replace(/^\//, '')
    .trim() || null;
}

function extractTipId($, el) {
  return $(el).find('.ani.poster, [data-tip]').first().attr('data-tip') || null;
}

// ═══════════════════════════════════════════════════════════════════
// GENRE LIST FROM NAV
// ═══════════════════════════════════════════════════════════════════

function parseGenreList($) {
  return each($, '#menu ul li ul.c4 li a', el =>
    (el.attr('title') || el.find('h3').text() || '').trim()
  ).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════
// EPISODE PARSING FROM CARDS
// ═══════════════════════════════════════════════════════════════════

function parseEpisodes($, ctx) {
  const subText = $(ctx).find('.ep-status.sub span').text().trim();
  const dubText = $(ctx).find('.ep-status.dub span').text().trim();
  return {
    sub: subText ? (parseInt(subText, 10) || 1) : null,
    dub: dubText ? (parseInt(dubText, 10) || 1) : null,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ITEM CARD PARSER (browse/search/A-Z/genre)
// ═══════════════════════════════════════════════════════════════════

function parseAitem($, el) {
  const posterLink = $(el).find('.ani.poster a, a.poster').first();
  const href = posterLink.attr('href') || $(el).find('a').first().attr('href');
  const id = extractId(href);
  const tipId = extractTipId($, el);
  const nameEl = $(el).find('.name.d-title');
  const name = (nameEl.attr('data-jp') || nameEl.text() || '').trim();
  const jname = nameEl.attr('data-jp') || null;
  const poster = $(el).find('img').attr('src');
  const eps = parseEpisodes($, el);

  // Type from .meta .right
  const type = $(el).find('.meta .right').first().text().trim() || null;

  return { id, tipId, name, jname, poster, type, episodes: eps };
}

// ═══════════════════════════════════════════════════════════════════
// NAV URL BUILDER
// ═══════════════════════════════════════════════════════════════════

const TYPE_SLUGS = new Set(['movie', 'tv', 'ova', 'ona', 'special', 'music']);

function toApiUrl(siteHref, providerName) {
  if (!siteHref || siteHref === 'javascript:;') return null;
  const base = `/api/v2/${providerName}`;

  const gm = siteHref.match(/^\/genre\/(.+)$/);
  if (gm) return `${base}/genre/${gm[1]}`;

  const am = siteHref.match(/^\/az-list\/?(.*)$/);
  if (am !== null) return am[1] ? `${base}/azlist/${am[1]}` : `${base}/azlist`;

  const wm = siteHref.match(/\/watch\/(.+)$/);
  if (wm) return `${base}/anime/${extractId(wm[0])}`;

  const slug = siteHref.replace(/^\//, '');

  if (slug.startsWith('type/')) return `${base}/type/${slug.replace('type/', '')}`;
  if (TYPE_SLUGS.has(slug)) return `${base}/type/${slug}`;
  if (slug === 'filter') return `${base}/search`;
  if (slug === 'home') return `${base}/home`;
  if (slug === 'latest-updated') return `${base}/category/latest-updated`;
  if (slug === 'new-release') return `${base}/category/new-release`;
  if (slug === 'most-viewed') return `${base}/category/most-viewed`;
  if (slug.startsWith('status/')) return `${base}/category/${slug}`;

  return siteHref;
}

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR ITEM PARSER (related/recommended from watch page)
// ═══════════════════════════════════════════════════════════════════

function parseSidebarItem($, el) {
  const href = el.attr('href');
  return {
    id: extractId(href),
    name: $(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text().trim() || null,
    jname: $(el).find('.name.d-title').attr('data-jp') || null,
    poster: $(el).find('img').attr('src'),
    type: $(el).find('.meta span.dot').first().text().trim() || null,
    relationType: null,
    episodes: {
      sub: parseInt($(el).find('.meta span.dot').eq(1).text().trim(), 10) || null,
      dub: null,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTED PARSERS
// ═══════════════════════════════════════════════════════════════════

export function parseNavMenu(html, providerName = 'anikoto') {
  const $ = load(html);

  const genres = each($, '#menu ul li ul.c4 li a', el => ({
    name: (el.attr('title') || el.find('h3').text() || '').trim(),
    url: toApiUrl(el.attr('href'), providerName),
  })).filter(g => g.name);

  const types = each($, '#menu ul li ul.c1 li a', el => ({
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

  return {
    brand: {
      link: $('header .logo a').attr('href') || '/home',
      logo: $('header .logo img').attr('src') || null,
    },
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
      rating: ($(el).find('.meta i.rating').text().trim() || '').replace(/\s+/g, ' ') || null,
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

  const latestEpisodeAnimes = each($, '#recent-update .ani.items .item', el => ({
    id: extractId($(el).find('.ani.poster a').attr('href')),
    tipId: extractTipId($, el),
    name: ($(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text() || '').trim(),
    jname: $(el).find('.name.d-title').attr('data-jp') || null,
    poster: $(el).find('img').attr('src'),
    type: $(el).find('.meta .right').first().text().trim() || null,
    episodes: parseEpisodes($, el),
  }));

  const newReleases = each($, '.top-tables section[data-name="new-release"] .scaff.items a.item', el => ({
    id: extractId(el.attr('href')),
    name: ($(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text() || '').trim(),
    jname: $(el).find('.name.d-title').attr('data-jp') || null,
    poster: $(el).find('img').attr('src'),
    type: null,
    episodes: parseEpisodes($, el),
  }));

  const topUpcomingAnimes = each($, '.top-tables section[data-name="new-added"] .scaff.items a.item', el => ({
    id: extractId(el.attr('href')),
    name: ($(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text() || '').trim(),
    jname: $(el).find('.name.d-title').attr('data-jp') || null,
    poster: $(el).find('img').attr('src'),
    type: null,
    episodes: parseEpisodes($, el),
  }));

  const today = each($, '.tab-content[data-name="day"] .scaff.side.items a.item', el => {
    const rc = el.attr('class')?.match(/rank(\d+)/)?.[1];
    return {
      id: extractId(el.attr('href')),
      rank: rc ? parseInt(rc, 10) : num($(el).find('.rank').text().trim()),
      name: ($(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text() || '').trim(),
      jname: $(el).find('.name.d-title').attr('data-jp') || null,
      poster: $(el).find('img').attr('src'),
      episodes: parseEpisodes($, el),
    };
  });

  const week = each($, '.tab-content[data-name="week"] .scaff.side.items a.item', el => ({
    id: extractId(el.attr('href')),
    rank: num($(el).find('.rank').text().trim()),
    name: ($(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text() || '').trim(),
    jname: $(el).find('.name.d-title').attr('data-jp') || null,
    poster: $(el).find('img').attr('src'),
    episodes: parseEpisodes($, el),
  }));

  const month = each($, '.tab-content[data-name="month"] .scaff.side.items a.item', el => ({
    id: extractId(el.attr('href')),
    rank: num($(el).find('.rank').text().trim()),
    name: ($(el).find('.name.d-title').attr('data-jp') || $(el).find('.name.d-title').text() || '').trim(),
    jname: $(el).find('.name.d-title').attr('data-jp') || null,
    poster: $(el).find('img').attr('src'),
    episodes: parseEpisodes($, el),
  }));

  return { genres, spotlightAnimes, latestEpisodeAnimes, newReleases, topUpcomingAnimes, top10Animes: { today, day: [], week, month } };
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
    azList: each($, 'footer .azlist ul li a', el => ({ label: el.text().trim(), href: el.attr('href') || null })).filter(a => a.label),
    footerMenu: each($, 'footer .inline-links ul li a', el => ({ label: ($(el).find('span').text().trim() || el.text().trim()), href: el.attr('href') || null })).filter(m => m.label),
  };
}

export function parseSearchFromHtml(html) {
  const $ = load(html);
  const animes = each($, '#list-items .item', el => parseAitem($, el));
  return { animes, currentPage: getCurrentPage($), totalPages: getLastPage($), hasNextPage: getCurrentPage($) < getLastPage($), totalCount: null };
}

export function parseAzListFromHtml(html) {
  const $ = load(html);
  const animes = each($, '#list-items .item, .items .item', el => parseAitem($, el));
  return { sortOption: 'all', animes, currentPage: getCurrentPage($), totalPages: getLastPage($), hasNextPage: getCurrentPage($) < getLastPage($) };
}

export function parseListPage(html) {
  const $ = load(html);
  return {
    title: $('.head .title').first().text().trim() || null,
    animes: each($, '#list-items .item, .items .item', el => parseAitem($, el)),
    currentPage: getCurrentPage($),
    totalPages: getLastPage($),
    hasNextPage: getCurrentPage($) < getLastPage($),
  };
}

// ═══════════════════════════════════════════════════════════════════
// WATCH PAGE (HTML) PARSER
// ═══════════════════════════════════════════════════════════════════

function getDetailField($, label) {
  let val = null;
  $('.bmeta .meta div').each((_, div) => {
    const divText = $(div).text().trim();
    if (divText.startsWith(label)) {
      // Get text from <span> or <a> inside this div, NOT from sibling spans
      const s = $(div).find('> span').first();
      const a = $(div).find('a').first();
      if (s.length) val = s.clone().find('span').remove().end().text().trim() || null;
      else if (a.length) val = a.text().trim() || null;
      return false;
    }
  });
  return val;
}

function getDetailLinks($, label) {
  const links = [];
  $('.bmeta .meta div').each((_, div) => {
    if ($(div).text().trim().startsWith(label)) {
      $(div).find('a').each((_, a) => links.push($(a).find('span').first().text().trim() || $(a).text().trim()));
      return false;
    }
  });
  return links;
}

function getDetailText($, label) {
  let val = null;
  $('.bmeta .meta div').each((_, div) => {
    if ($(div).text().trim().startsWith(label)) {
      val = $(div).text().replace(label, '').trim() || null;
      return false;
    }
  });
  return val;
}

export function parseAnime(html) {
  const $ = load(html);

  // ── IDs ─────────────────────────────────────────────────────────────
  const animeId = $('#watch-main').attr('data-id') || null;
  const dataUrl = $('#watch-main').attr('data-url') || '';
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const slug = extractId(dataUrl || canonical);

  // ── Basic info ──────────────────────────────────────────────────────
  const name = $('h1.title.d-title').text().trim() || null;
  const jname = $('h1.title.d-title').attr('data-jp') || null;
  const poster = $('.poster img[itemprop="image"]').attr('src') || $('meta[property="og:image"]').attr('content') || null;

  // Synonyms from .names div
  const namesDiv = $('.binfo .info .names').text().trim();
  const synonyms = namesDiv ? namesDiv.split(';').map(s => s.trim()).filter(Boolean).join(', ') : jname;

  // Description
  const description = $('.synopsis .shorting .content').text().trim() || $('meta[property="og:description"]').attr('content') || null;

  // ── Meta fields ────────────────────────────────────────────────────
  const rating = $('.meta i.rating').text().trim() || null;
  const type = getDetailField($, 'Type:');
  const premiered = getDetailField($, 'Premiered:');
  const aired = getDetailField($, 'Aired:');
  const status = getDetailField($, 'Status:') || getDetailText($, 'Status:');
  const duration = getDetailField($, 'Duration:');
  const episodesText = getDetailField($, 'Episodes:');
  const episodesTotal = (!episodesText || episodesText === '?') ? null : parseInt(episodesText, 10) || null;
  const score = getDetailField($, 'MAL:');
  const genres = getDetailLinks($, 'Genres:');
  const studios = getDetailLinks($, 'Studios:');
  const producers = getDetailLinks($, 'Producers:');

  // ── MAL ID from inline script ──────────────────────────────────────
  let malId = null;
  $('script').each((_, el) => {
    const s = $(el).html();
    if (s && s.includes('mangaId')) {
      const m = s.match(/const\s+mangaId\s*=\s*(\d+)/);
      if (m) malId = m[1];
    }
  });

  // ── Sub / Dub ──────────────────────────────────────────────────────
  const hasSub = $('.meta i.sub').length > 0;
  const hasDub = $('.meta i.dub').length > 0;

  // ── Related (from #watch-order section) ────────────────────────────
  const related = each($, '#watch-order .scaff.side.items a.item', el => parseSidebarItem($, el));

  // ── Recommended (other sidebar sections, NOT #watch-order) ──────────
  // Only the section that appears below the watch page (has class w-side-section)
  const recommended = each($, '.w-side-section:not(#watch-order) .scaff.side.items a.item', el => parseSidebarItem($, el));

  return {
    anime: {
      id: slug || animeId,
      animeId,
      name,
      jname,
      synonyms,
      japanese: jname,
      poster,
      description,
      type,
      rating,
      episodes: { sub: hasSub ? 1 : null, dub: hasDub ? 1 : null },
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

// ═══════════════════════════════════════════════════════════════════
// JSON API PARSER (anikotoapi.site)
// ═══════════════════════════════════════════════════════════════════

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
      episodes: { sub: d.is_sub || 0, dub: d.is_dub || 0 },
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

export function parseEpisodesFromJson(data) {
  if (!data.ok) throw new Error('Invalid JSON API response');
  const anime = data.data.anime;
  const eps = data.data.episodes || [];
  return {
    totalEpisodes: eps.length,
    malId: anime.mal_id || null,
    alId: anime.ani_id || null,
    episodes: eps.map(ep => ({
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
