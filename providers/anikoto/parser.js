// providers/anikoto/parser.js
import { load, text, attr, each, num } from '../../utils/dom.js';

function getLastPage($) {
  const lastHref = $('nav .pagination li:last-child a.page-link, nav .pagination .page-item:last-child a').attr('href');
  if (lastHref) {
    const m = lastHref.match(/page=(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  let max = 1;
  $('nav .pagination .page-item .page-link, nav .pagination li a.page-link').each((_, el) => {
    const n = parseInt($(el).text().trim(), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max;
}

function getCurrentPage($) {
  return num($('nav .pagination .page-item.active .page-link, nav .pagination li.active a').text().trim()) || 1;
}

function parseEpisodes($, ctx) {
  return {
    sub: num($(ctx).find('.ep-status.sub span').text().trim()) || 
         ($(ctx).find('.ep-status.sub').length ? 1 : null),
    dub: num($(ctx).find('.ep-status.dub span').text().trim()) || 
         ($(ctx).find('.ep-status.dub').length ? 1 : null),
  };
}

function parseAitem($, el) {
  const href = attr($, '.ani.poster a, a.poster', 'href', el) || attr($, 'a', 'href', el);
  const id = href ? href.replace('/watch/', '').split('/ep-')[0].replace(/^\//, '').trim() : null;
  const name = attr($, '.name.d-title', 'data-jp', el) || text($, '.name.d-title', el) || text($, 'a.name', el);
  const jname = attr($, '.name.d-title', 'data-jp', el) || null;
  const poster = attr($, 'img', 'src', el);
  const eps = parseEpisodes($, el);
  
  let type = null;
  $(el).find('.meta .m-item label, .meta .right').each((_, b) => {
    const t = $(b).text().trim();
    if (t && isNaN(parseInt(t, 10)) && !['Sub', 'Dub'].includes(t)) type = t;
  });
  
  return { id, name, jname, poster, type, episodes: eps };
}

function parseGenreList($) {
  return each($, '#menu ul.c4 li a h3, #menu ul li ul.c4 li a', el => 
    ($(el).text() || $(el).attr('title') || '').trim()
  ).filter(Boolean);
}

// Known slugs for anikoto.to
const TYPE_SLUGS = new Set(['movie', 'tv', 'ova', 'ona', 'special', 'music']);
const CATEGORY_SLUGS = new Set([
  'new-release', 'latest-updated', 'most-viewed',
  'status/not-yet-aired', 'status/currently-airing', 'status/finished-airing',
]);

function toApiUrl(siteHref, providerName) {
  if (!siteHref || siteHref === 'javascript:;') return null;
  
  const base = `/api/v2/${providerName}`;
  
  const genreMatch = siteHref.match(/^\/genre\/(.+)$/);
  if (genreMatch) return `${base}/genre/${genreMatch[1]}`;
  
  const azMatch = siteHref.match(/^\/az-list\/?(.*)$/);
  if (azMatch !== null) {
    return azMatch[1] ? `${base}/azlist/${azMatch[1]}` : `${base}/azlist`;
  }
  
  const watchMatch = siteHref.match(/^\/watch\/(.+)$/);
  if (watchMatch) {
    // Extract just the slug part (remove /ep-XX suffix if present)
    const slug = watchMatch[1].split('/ep-')[0];
    return `${base}/anime/${slug}`;
  }
  
  const slug = siteHref.replace(/^\//, '');
  
  if (slug.startsWith('type/')) return `${base}/type/${slug.replace('type/', '')}`;
  if (TYPE_SLUGS.has(slug)) return `${base}/type/${slug}`;
  if (CATEGORY_SLUGS.has(slug)) return `${base}/category/${slug}`;
  
  // Handle status paths
  if (slug.startsWith('status/')) return `${base}/category/${slug}`;
  
  // Handle special pages
  if (slug === 'filter') return `${base}/search`;
  if (slug === 'random') return `/api/v2/${providerName}/random`;
  if (slug === 'home') return `${base}/home`;
  
  return siteHref;
}

export function parseNavMenu(html, providerName = 'anikoto') {
  const $ = load(html);
  
  const genres = each($, '#menu ul li ul.c4 li a', (el) => ({
    name: ($(el).text() || $(el).attr('title') || '').trim(),
    url: toApiUrl(el.attr('href'), providerName),
  })).filter(g => g.name);
  
  const types = each($, '#menu ul li ul.c1 li a', (el) => ({
    name: ($(el).text() || $(el).attr('title') || '').trim(),
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
        country: [{ label: 'China', value: '2' }, { label: 'Japan', value: '11' }],
        language: ['sub', 'dub'],
      },
    },
    language: ['en', 'jp'],
  };
}

export function parseSearch(html) {
  const $ = load(html);
  
  const animes = each($, '#list-items .item', (el) => parseAitem($, el));
  
  const totalText = $('.list-info .total, .list-info span').first().text().replace(/[^0-9]/g, '');
  const totalCount = num(totalText);
  
  const cur = getCurrentPage($);
  const last = getLastPage($);
  
  return {
    animes,
    currentPage: cur,
    totalPages: last,
    hasNextPage: cur < last,
    totalCount,
  };
}

export function parseAzList(html) {
  const $ = load(html);
  
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

export function parseListPage(html) {
  const $ = load(html);
  
  const title = $('.head .title, aside .title').first().text().trim() || null;
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

export function parseAnime(html) {
  const $ = load(html);
  
  let id = $('link[rel="canonical"]').attr('href')?.replace(/^https?:\/\/[^\/]+\/watch\//, '').replace(/\/ep-\d+$/, '').trim() || null;
  
  if (!id) {
    const watchUrl = $('meta[property="og:url"]').attr('content');
    id = watchUrl?.replace(/^https?:\/\/[^\/]+\/watch\//, '').replace(/\/ep-\d+$/, '').trim() || null;
  }
  
  const name = $('meta[property="og:title"]').attr('content') || text($, 'h1.title');
  const jname = $('meta[property="og:title"]').attr('content') || null;
  const poster = $('meta[property="og:image"]').attr('content') || null;
  const description = $('meta[property="og:description"]').attr('content') || 
                      text($, '.description, .synopsis, .desc');
  
  // Try to find MAL/AL IDs from page data attributes or links
  const malId = $('#watch-page').attr('data-mal-id') || 
                $('a[href*="myanimelist.net/anime/"]').attr('href')?.match(/anime\/(\d+)/)?.[1] || null;
  const alId = $('#watch-page').attr('data-al-id') || 
               $('a[href*="anilist.co/anime/"]').attr('href')?.match(/anime\/(\d+)/)?.[1] || null;
  
  const episodes = {
    sub: num($('.sub-info .sub, .info .sub span').first().text().trim()),
    dub: num($('.dub-info .dub, .info .dub span').first().text().trim()),
  };
  
  return {
    anime: {
      id,
      animeId: id,
      name,
      jname,
      synonyms: jname,
      japanese: jname,
      poster,
      description,
      type: null,
      rating: text($, '.rating, .m-item.rated span'),
      episodes,
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
      malId,
      alId,
    },
    related: [],
    recommended: [],
    seasons: [],
  };
}

export function parseHome(html) {
  const $ = load(html);
  
  const genres = parseGenreList($);
  
  const spotlightAnimes = each($, '#hotest .swiper-slide .item, .swiper-container .item', (el) => ({
    id: attr($, 'a.btn.play', 'href', el)?.replace('/watch/', '') || null,
    name: text($, '.title.d-title, h2.title', el),
    jname: attr($, '.title.d-title', 'data-jp', el) || null,
    poster: $(el).find('.image div').attr('style')?.match(/url\(([^)]+)\)/)?.[1] || null,
    description: text($, '.synopsis', el),
    rating: text($, '.meta .rating', el),
    rank: 0,
    otherInfo: [],
    genres: [],
    episodes: parseEpisodes($, el),
  }));
  
  const latestEpisodeAnimes = each($, '#recent-update .item, .latest .item', (el) => ({
    id: attr($, '.ani.poster a, a.poster', 'href', el)?.replace('/watch/', '').split('/ep-')[0].trim() || null,
    name: attr($, '.name.d-title', 'data-jp', el) || text($, '.name.d-title', el),
    jname: attr($, '.name.d-title', 'data-jp', el) || null,
    poster: attr($, 'img', 'src', el),
    type: null,
    episodes: parseEpisodes($, el),
  }));
  
  const top10Animes = {
    today: each($, '.scaff.side.items a.item, .top .item', (el) => ({
      id: attr($, 'a', 'href', el)?.replace('/watch/', '') || null,
      rank: num(text($, '.rank', el)) || num($(el).find('.rank').text().trim()),
      name: text($, '.name.d-title', el),
      poster: attr($, 'img', 'src', el),
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

export function parseIndex(html) {
  const $ = load(html);
  
  const title = $('title').text().trim() || null;
  const description = $('meta[name="description"]').attr('content') || null;
  const ogImage = $('meta[property="og:image"]').attr('content') || null;
  const canonical = $('link[rel="canonical"]').attr('href') || null;
  
  const mostSearched = each($, '.search-term a.item', (el) => ({
    label: el.text().trim(),
    keyword: el.text().trim().replace(/,?\s*$/, ''),
  }));
  
  const genres = parseGenreList($);
  
  const azList = each($, 'footer .azlist ul li a', (el) => ({
    label: el.text().trim(),
    href: el.attr('href') || null,
  })).filter(a => a.label);
  
  const footerMenu = each($, 'footer .inline-links ul li a', (el) => ({
    label: el.text().trim(),
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

export function buildEpisodeSources(epNum, malId, alId, hasSub = true, hasDub = false) {
  const sources = {};
  
  if (malId) {
    if (hasSub) sources.sub = `https://megaplay.buzz/stream/mal/${malId}/${epNum}/sub`;
    if (hasDub) sources.dub = `https://megaplay.buzz/stream/mal/${malId}/${epNum}/dub`;
  }
  
  if (alId) {
    if (hasSub) sources.aniSub = `https://megaplay.buzz/stream/ani/${alId}/${epNum}/sub`;
    if (hasDub) sources.aniDub = `https://megaplay.buzz/stream/ani/${alId}/${epNum}/dub`;
  }
  
  return sources;
}
