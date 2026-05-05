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

// ─── Browse ───────────────────────────────────────────────────────────────────
// Hits /browser with any combination of filter params — keyword is optional.
// Supported filters (all optional, can be combined freely):
//   keyword  → text search
//   sort     → updated_date | release_date | end_date | added_date | trending
//              | title_az | avg_score | mal_score | most_viewed | most_followed | episode_count
//   type[]   → movie | tv | ova | ona | special | music
//   genre[]  → genre id (numeric) or slug — passed through as-is
//   status[] → info | releasing | completed
//   season[] → fall | summer | spring | winter | unknown
//   year[]   → 2026 | 2025 | ... | 1900s
//   rating[] → g | pg | pg_13 | r | r+ | rx
//   country[]→ 2 (China) | 11 (Japan)
//   language[]→ sub | softsub | dub | subdub

export async function browse(filters = {}, page = 1) {
  const { keyword, ...rest } = filters;
  const params = {
    keyword: keyword || ' ',
    page,
    ...rest,
  };
  const html = await get(`${BASE}/browser`, { params });
  const result = parseSearch(html);
  return {
    ...result,
    filters: { keyword: keyword || null, ...rest },
  };
}
