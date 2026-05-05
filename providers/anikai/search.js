import { get } from '../../utils/http.js';
import { parseSearch } from './parser.js';
import { BASE_URLS } from '../../constants/baseurl.js';

const BASE = BASE_URLS.anikai;

export async function query(q, page = 1, filters = {}) {
  const params = { keyword: q, page, ...filters };
  const html = await get(`${BASE}/browser`, { params });
  const result = parseSearch(html);
  return {
    ...result,
    searchQuery: q,
    searchFilters: filters,
  };
}
