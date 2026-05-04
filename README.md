# HiAnime API — Hono Edition

A drop-in rebuild of the original Vercel Edge scraper API, now running on **Hono** with **Axios**, **IORedis**, and **Pino**. All scraping logic is unchanged.

## What changed vs original

| Concern | Original | This version |
|---|---|---|
| Framework | Vercel Edge Functions | **Hono** on `@hono/node-server` |
| HTTP client | `fetch` (native) | **Axios** (with typed instances + interceptors) |
| Caching | Vercel CDN headers only | **IORedis** in-memory + HTTP cache headers |
| Logging | `console.error` | **Pino** (pretty in dev, JSON in prod) |
| Extra feature | — | `?raw=1` on any page endpoint returns raw HTML |

Scraping logic (`util/scraper.js`, `util/format.js`), config, and all route schemas are **100% identical** to the original.

---

## Setup

```bash
cp .env.example .env
# Edit .env — at minimum set REDIS_URL if you want Redis caching
npm install
npm run dev   # node --watch
npm start     # production
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | `development` → pino-pretty, `production` → JSON logs |
| `REDIS_URL` | _(unset)_ | Redis connection string e.g. `redis://localhost:6379`. If unset, caching is disabled. |
| `REDIS_PASSWORD` | _(unset)_ | Redis password (optional) |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins |
| `LOG_LEVEL` | `info` | Pino log level (`trace` `debug` `info` `warn` `error`) |

---

## Endpoints

All endpoints accept `GET` only. The route structure mirrors the original `vercel.json` rewrites.

### Home
```
GET /api/home
GET /api/home?raw=1          ← returns full HTML of hianime home page
```

### Anime Info
```
GET /api/anime?id=<slug>
GET /api/anime?id=<slug>&raw=1
GET /api/v2/hianime/anime/:id
```

### Episodes
```
GET /api/episodes?id=<slug>
GET /api/episodes?id=<slug>&raw=1
GET /api/v2/hianime/anime/:animeId/episodes
```

### Search
```
GET /api/search?q=<query>[&page=1&type=tv&status=airing&...&raw=1]
GET /api/v2/hianime/search?q=...
```

### Search Suggestion
```
GET /api/search-suggestion?q=<partial>
GET /api/v2/hianime/search/suggestion?q=...
```

### Category
```
GET /api/category?name=<category>[&page=1&raw=1]
GET /api/v2/hianime/category/:name
```
Valid categories: `subbed-anime`, `dubbed-anime`, `recently-added`, `most-popular`, `most-favorite`, `completed`, `recently-updated`, `top-airing`, `top-upcoming`, `movie`, `special`, `ova`, `ona`, `tv`, `latest-episode`

### Genre
```
GET /api/genre?name=<genre>[&page=1&raw=1]
GET /api/v2/hianime/genre/:name
```

### Producer
```
GET /api/producer?name=<producer>[&page=1&raw=1]
GET /api/v2/hianime/producer/:name
```

### AZ List
```
GET /api/azlist?sort=<sort>[&page=1&raw=1]
GET /api/v2/hianime/azlist/:sort
```
Valid sorts: `all`, `other`, `0-9`, `a`–`z`

### Schedule
```
GET /api/schedule[?date=YYYY-MM-DD&raw=1]
GET /api/v2/hianime/schedule
```

### Episode Servers
```
GET /api/servers?episodeId=<id>
GET /api/v2/hianime/servers?episodeId=<id>
```

### Episode Sources
```
GET /api/sources?serverId=<id>
GET /api/v2/hianime/sources?serverId=<id>
```

### Qtip (hover card)
```
GET /api/qtip?id=<numericId>
GET /api/v2/hianime/qtip/:id
```

### Health
```
GET /health
```

---

## `?raw=1` Feature

Appending `?raw=1` to any page-based endpoint returns the **complete raw HTML** of the upstream hianime page instead of parsed JSON. This is useful for debugging selectors or building your own parsers.

Supported endpoints: `home`, `anime`, `episodes`, `search`, `category`, `genre`, `producer`, `azlist`, `schedule`

Not supported (AJAX-only endpoints with no full page): `servers`, `sources`, `qtip`, `search-suggestion`

Raw HTML responses are cached in Redis (if available) for `CONFIG.CACHE.RAW_HTML` seconds (default: 5 min).

---

## Caching

Redis caching is optional. When `REDIS_URL` is set:

- Cache keys are namespaced: `api:<route>:<params>` and `raw:<route>:<params>`
- TTLs match the original `CONFIG.CACHE.*` values
- On Redis errors the server falls back to scraping live (no crash)

When `REDIS_URL` is unset, Cache-Control headers are still set correctly for any upstream CDN.
