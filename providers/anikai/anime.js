import { get } from '../../utils/http.js';
import { parseAnime, parseHome, parseAzList, parseListPage } from './parser.js';
import { BASE_URLS } from '../../constants/baseurl.js';

const BASE = BASE_URLS.anikai;

export async function getHome() {
  const html = await get(`${BASE}/home`);
  return parseHome(html);
}

export async function getById(id) {
  const html = await get(`${BASE}/watch/${id}`);
  return parseAnime(html);
}

export async function getAzList(sortOption = 'all', page = 1) {
  const path = sortOption === 'all' ? '/az-list' : `/az-list/${sortOption}`;
  const html = await get(`${BASE}${path}`, { params: { page } });
  return parseAzList(html);
}

export async function getGenre(name, page = 1) {
  const html = await get(`${BASE}/genres/${name}`, { params: { page } });
  return parseListPage(html);
}

export async function getCategory(name, page = 1) {
  // categories: movie, tv, ova, ona, special, new-releases, updates, ongoing, recent, completed, upcoming
  const html = await get(`${BASE}/${name}`, { params: { page } });
  return parseListPage(html);
}
