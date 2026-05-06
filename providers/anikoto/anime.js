// providers/anikoto/anime.js
import { get } from '../../utils/http.js';
import {
  parseHome, parseAnime, parseListPage, parseNavMenu, parseIndex,
  parseEpisodesFromJson, parseAnimeFromJson, parseAzListFromHtml,
} from './parser.js';
import { BASE_URLS } from '../../constants/baseurl.js';

const BASE = BASE_URLS.anikoto;
const API_BASE = BASE_URLS.anikotoApi;

// ═══════════════════════════════════════════════════════════════════
// DUAL-SOURCE HELPERS
// ═══════════════════════════════════════════════════════════════════

// Strategy: JSON API first (faster, more reliable), fallback to HTML scraper
// If BOTH fail, throw error with details

async function fetchAnimeById(id) {
  const isNumeric = /^\d+$/.test(id);
  const errors = [];

  // If numeric, try JSON API first
  if (isNumeric) {
    try {
      const data = await get(`${API_BASE}/series/${id}`);
      return { source: 'json', result: parseAnimeFromJson(data) };
    } catch (e) {
      errors.push(`JSON API: ${e.message}`);
    }
  }

  // Try HTML scraper (works for both numeric IDs and slugs)
  try {
    const html = await get(`${BASE}/watch/${id}`);
    return { source: 'html', result: parseAnime(html) };
  } catch (e) {
    errors.push(`HTML scraper: ${e.message}`);
  }

  throw new Error(`All sources failed for "${id}": ${errors.join(' | ')}`);
}

async function fetchEpisodesById(id, animeId) {
  const errors = [];

  // Try JSON API first using the anime's numeric ID
  const numericId = animeId || (/^\d+$/.test(id) ? id : null);
  if (numericId) {
    try {
      const data = await get(`${API_BASE}/series/${numericId}`);
      if (data.ok && data.data?.episodes?.length) {
        return parseEpisodesFromJson(data);
      }
      errors.push('JSON API: No episodes found');
    } catch (e) {
      errors.push(`JSON API: ${e.message}`);
    }
  }

  // If numeric ID failed and we have a slug, try scraping the page for the numeric ID, then retry
  if (!numericId && !/^\d+$/.test(id)) {
    try {
      const html = await get(`${BASE}/watch/${id}`);
      const animeIdFromPage = extractAnimeIdFromHtml(html);
      if (animeIdFromPage) {
        try {
          const data = await get(`${API_BASE}/series/${animeIdFromPage}`);
          if (data.ok && data.data?.episodes?.length) {
            return parseEpisodesFromJson(data);
          }
        } catch (e) {
          errors.push(`JSON API (retry with ${animeIdFromPage}): ${e.message}`);
        }
      }
    } catch (e) {
      errors.push(`HTML scraper for ID: ${e.message}`);
    }
  }

  throw new Error(`All episode sources failed: ${errors.join(' | ')}`);
}

// Simple extraction from watch page HTML without full parsing
function extractAnimeIdFromHtml(html) {
  const match = html.match(/data-id="(\d+)"/);
  return match ? match[1] : null;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

export async function getHome() {
  const html = await get(`${BASE}/home`);
  return parseHome(html);
}

export async function getIndex() {
  const html = await get(`${BASE}/`);
  return parseIndex(html);
}

export async function getById(id) {
  const { result } = await fetchAnimeById(id);
  return result;
}

export async function getAzList(sortOption = 'all', page = 1) {
  const path = sortOption === 'all' ? '/az-list' : `/az-list/${sortOption}`;
  const html = await get(`${BASE}${path}`, { params: page > 1 ? { page } : {} });
  return parseAzListFromHtml(html);
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
  const html = await get(`${BASE}/type/${name.toLowerCase()}`, { params });
  return parseListPage(html);
}

export async function getNavMenu(providerName = 'anikoto') {
  const html = await get(`${BASE}/home`);
  return parseNavMenu(html, providerName);
}

export async function getEpisodes(id) {
  // First get anime details to obtain numeric ID for episode lookup
  const { result: animeData } = await fetchAnimeById(id);
  const numericId = animeData?.anime?.animeId || null;
  return await fetchEpisodesById(id, numericId);
}

export async function getEpisode(id, epNum) {
  const episodesData = await getEpisodes(id);
  const n = parseInt(epNum, 10);
  const ep = episodesData.episodes.find(e => e.number === n);
  if (!ep) throw new Error(`Episode ${n} not found for "${id}". Total: ${episodesData.totalEpisodes}.`);
  return { malId: episodesData.malId, alId: episodesData.alId, episode: ep };
}
