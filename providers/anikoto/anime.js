// providers/anikoto/anime.js
import { get } from '../../utils/http.js';
import {
  parseAnime,
  parseHome,
  parseAzList,
  parseListPage,
  parseNavMenu,
  parseIndex,
} from './parser.js';
import { BASE_URLS } from '../../constants/baseurl.js';

const BASE = BASE_URLS.anikoto;

export async function getHome() {
  const html = await get(`${BASE}/home`);
  return parseHome(html);
}

export async function getIndex() {
  const html = await get(`${BASE}/`);
  return parseIndex(html);
}

export async function getById(id) {
  // Primary: fetch from main site watch page
  // Fallback: fetch JSON from anikotoapi.site
  try {
    const html = await get(`${BASE}/watch/${id}`);
    return parseAnime(html);
  } catch (e) {
    // Try JSON API endpoint
    const jsonUrl = `https://anikotoapi.site/series/${id}`;
    const data = await get(jsonUrl);
    return parseAnimeFromJson(data);
  }
}

export async function getAzList(sortOption = 'all', page = 1) {
  const path = sortOption === 'all' ? '/az-list' : `/az-list/${sortOption}`;
  const html = await get(`${BASE}${path}`, { params: { page } });
  return parseAzList(html);
}

export async function getGenre(name, page = 1, sort = null) {
  const params = { page };
  if (sort) params.sort = sort;
  const html = await get(`${BASE}/genre/${name}`, { params });
  return parseListPage(html);
}

export async function getCategory(name, page = 1, sort = null) {
  const params = { page };
  if (sort) params.sort = sort;
  const html = await get(`${BASE}/${name}`, { params });
  return parseListPage(html);
}

export async function getType(name, page = 1, sort = null) {
  const params = { page };
  if (sort) params.sort = sort;
  const html = await get(`${BASE}/${name}`, { params });
  return parseListPage(html);
}

export async function getNavMenu(providerName = 'anikoto') {
  const html = await get(`${BASE}/home`);
  return parseNavMenu(html, providerName);
}

export async function getEpisodes(id) {
  // Try JSON API first for reliable episode data
  try {
    const jsonUrl = `https://anikotoapi.site/series/${id}`;
    const data = await get(jsonUrl);
    return parseEpisodesFromJson(data);
  } catch {
    // Fallback to HTML parsing
    const html = await get(`${BASE}/watch/${id}`);
    return parseEpisodesFromHtml(html, id);
  }
}

export async function getEpisode(id, epNum) {
  try {
    const jsonUrl = `https://anikotoapi.site/series/${id}`;
    const data = await get(jsonUrl);
    const episodes = parseEpisodesFromJson(data);
    
    const n = parseInt(epNum, 10);
    const ep = episodes.episodes.find((e) => e.number === n);

    if (!ep) {
      throw new Error(`Episode ${n} not found for "${id}". Total episodes: ${episodes.totalEpisodes}.`);
    }

    return { malId: episodes.malId, alId: episodes.alId, episode: ep };
  } catch (e) {
    // Fallback to HTML
    const html = await get(`${BASE}/watch/${id}`);
    const episodes = parseEpisodesFromHtml(html, id);
    
    const n = parseInt(epNum, 10);
    const ep = episodes.episodes.find((e) => e.number === n);

    if (!ep) {
      throw new Error(`Episode ${n} not found for "${id}". Total episodes: ${episodes.totalEpisodes}.`);
    }

    return { malId: episodes.malId, alId: episodes.alId, episode: ep };
  }
}

// Internal helpers for JSON-based parsing
function parseAnimeFromJson(data) {
  if (!data.ok) throw new Error('Invalid JSON response');
  
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

function parseEpisodesFromJson(data) {
  if (!data.ok) throw new Error('Invalid JSON response');
  
  const d = data.data;
  const anime = d.anime;
  const episodesList = d.episodes || [];
  
  const total = episodesList.length;
  const malId = anime.mal_id || null;
  const alId = anime.ani_id || null;
  const name = anime.title;
  
  const episodes = episodesList.map(ep => ({
    number: ep.number,
    title: ep.title,
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

export function parseEpisodesFromHtml(html, id) {
  const { load } = require('../../utils/dom.js');
  const $ = load(html);
  
  const total = $('.episode-section .ep-item').length || 
                parseInt($('.info .total').text().trim(), 10) || 0;
  
  const malId = $('#watch-page').attr('data-mal-id') || null;
  const alId = $('#watch-page').attr('data-al-id') || null;
  
  const episodes = [];
  $('.episode-section .ep-item').each((i, el) => {
    const $el = $(el);
    const number = parseInt($el.find('.ep-num').text().trim(), 10) || (i + 1);
    const title = $el.find('.ep-title').text().trim() || `${id} - Episode ${number}`;
    const subUrl = $el.attr('data-sub') || $el.find('a.sub').attr('href') || null;
    const dubUrl = $el.attr('data-dub') || $el.find('a.dub').attr('href') || null;
    
    episodes.push({
      number,
      title,
      isFiller: false,
      hasSub: !!subUrl,
      hasDub: !!dubUrl,
      sources: {
        ...(subUrl ? { sub: subUrl } : {}),
        ...(dubUrl ? { dub: dubUrl } : {}),
      },
    });
  });
  
  return {
    totalEpisodes: total,
    malId,
    alId,
    episodes,
  };
}
