# HiAnime API — Vercel Edge Scraper

A clean, zero-server-overhead REST API for [hianime.re](https://hianime.re), built with **Node.js + Vercel Edge Runtime**.  
Every endpoint runs at the edge — lightweight fetches and HTML parsing only, no heavy compute.

---

## Project Structure

```
hianime-api/
├── config/
│   ├── config.js        — constants, TTLs, valid category/server lists
│   └── baseurl.js       — primary (hianime.re) + backup (aniwatch.re) domain URLs
├── util/
│   ├── scraper.js       — all scraping logic (cheerio)
│   ├── format.js        — HTML → plain-object formatters
│   └── helper.js        — fetch wrappers, response builders, text utils
├── api/
│   ├── home.js
│   ├── search.js
│   ├── search-suggestion.js
│   ├── anime.js
│   ├── episodes.js
│   ├── servers.js
│   ├── sources.js
│   ├── category.js
│   ├── genre.js
│   ├── producer.js
│   ├── azlist.js
│   ├── schedule.js
│   └── qtip.js
├── vercel.json
└── package.json
```

---

## Deploy

```bash
npm install
npx vercel --prod
```

---

## Endpoints

All responses follow:
```json
{ "status": 200, "data": { ... } }
// or on error:
{ "status": 4xx|5xx, "error": "message", "data": null }
```

---

### `GET /api/home`
Returns the full home page — spotlight slider, trending, latest episodes, top-10 (today/week/month), and genre list.

**No params required.**

```json
{
  "spotlight": [ { "rank": 1, "id": "one-piece-100", "name": "One Piece", ... } ],
  "trending":  [ { "rank": 1, "id": "...", "name": "...", "poster": "..." } ],
  "latestEpisode": [ { "id": "...", "name": "...", "episodes": { "sub": 5, "dub": 3 } } ],
  "topUpcoming": [ ... ],
  "top10": { "today": [...], "week": [...], "month": [...] },
  "genres": ["Action", "Adventure", ...]
}
```

---

### `GET /api/search`
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | ✅ | Search keyword |
| `page` | number | — | Default: 1 |
| `type` | string | — | tv \| movie \| ova \| ona \| special \| music |
| `status` | string | — | airing \| complete \| upcoming |
| `rated` | string | — | g \| pg \| pg-13 \| r \| r+ \| rx |
| `season` | string | — | spring \| summer \| fall \| winter |
| `language` | string | — | sub \| dub \| sub-&-dub |
| `genres` | string | — | Comma-separated genre slugs |
| `sort` | string | — | recently-added \| score \| default … |

---

### `GET /api/search-suggestion`
| Param | Type | Required |
|-------|------|----------|
| `q` | string | ✅ |

Returns quick match suggestions from the hianime AJAX endpoint.

---

### `GET /api/anime`
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Anime slug e.g. `bleach-yaa9n` |

Returns full metadata: name, jname, poster, description, type, status, score, genres, studios, producers, episodes counts, related anime.

---

### `GET /api/episodes`
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Anime slug e.g. `bleach-yaa9n` |

Returns total episode count + episode list with numbers, IDs, titles, and filler flags.

```json
{
  "animeId": "12345",
  "totalEpisodes": 366,
  "episodes": [
    { "number": 1, "id": "1234", "slug": "The Day I Became a Shinigami", "isFiller": false }
  ]
}
```

---

### `GET /api/servers`
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `episodeId` | string | ✅ | Numeric episode ID from `/api/episodes` |

Returns sub / dub / raw server lists.

```json
{
  "episodeId": "230",
  "sub":  [ { "serverId": "56789", "serverName": "HD-1", "type": "sub" } ],
  "dub":  [ ... ],
  "raw":  [ ... ]
}
```

---

### `GET /api/sources`
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `serverId` | string | ✅ | `serverId` from `/api/servers` |

Returns the embed/stream link for the chosen server.

```json
{ "serverId": "56789", "type": "iframe", "server": 1, "link": "https://..." }
```

> **Note:** The `link` is typically an embed URL (megacloud, vidstreaming, etc.) that requires client-side decryption/resolution.

---

### `GET /api/category`
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Category slug |
| `page` | number | — | Default: 1 |

Valid `name` values: `subbed-anime`, `dubbed-anime`, `recently-added`, `most-popular`, `most-favorite`, `completed`, `recently-updated`, `top-airing`, `top-upcoming`, `movie`, `special`, `ova`, `ona`, `tv`, `latest-episode`

---

### `GET /api/genre`
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Genre slug e.g. `action`, `romance`, `isekai` |
| `page` | number | — | Default: 1 |

---

### `GET /api/producer`
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Producer slug e.g. `toei-animation` |
| `page` | number | — | Default: 1 |

---

### `GET /api/azlist`
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `sort` | string | — | `all` \| `other` \| `0-9` \| `a`…`z` (default: `all`) |
| `page` | number | — | Default: 1 |

---

### `GET /api/schedule`
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | — | `YYYY-MM-DD` format (default: today) |

Returns the airing schedule for a given date.

---

### `GET /api/qtip`
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Numeric anime ID from `data-tip` attributes in HTML |

Returns the lightweight hover-card: name, poster, type, episodes, score.

---

## Typical Usage Flow

```
1. GET /api/home                          → pick an anime from spotlight
2. GET /api/anime?id=bleach-yaa9n         → get full info
3. GET /api/episodes?id=bleach-yaa9n      → list all episodes
4. GET /api/servers?episodeId=230         → pick sub/dub + server
5. GET /api/sources?serverId=56789        → get stream embed link
```

---

## Switching to Backup Domain

Open `config/baseurl.js` and change:
```js
const BASE = PRIMARY;  // → change to BACKUP
```
