# HiAnime Scraper API

A **zero-dependency, single-file** REST API for [hianime.to](https://hianime.to) built with Node.js and deployed on **Vercel** (serverless, no cold-start framework overhead).

Powered by the [`aniwatch`](https://github.com/ghoshRitesh12/aniwatch) scraping library.

---

## 🚀 Deploy to Vercel

```bash
# 1. Clone / download this repo
# 2. Install deps
npm install

# 3. Deploy
npx vercel deploy
```

Or click the button below to one-click deploy:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

---

## 📡 Endpoints

All endpoints return:
```json
{
  "success": true,
  "data": { ... }
}
```

On error:
```json
{
  "success": false,
  "error": "error message"
}
```

---

### `GET /api/home`
Returns the homepage data — spotlight anime, trending, latest episodes, top-airing, genres, etc.

---

### `GET /api/search`
| Query param | Required | Description |
|---|---|---|
| `q` | ✅ | Search query |
| `page` | ❌ | Page number (default: 1) |
| any filter | ❌ | Extra filter params passed to scraper |

**Example:** `/api/search?q=one+piece&page=1`

---

### `GET /api/search/suggestion`
| Query param | Required | Description |
|---|---|---|
| `q` | ✅ | Partial query string for autocomplete |

**Example:** `/api/search/suggestion?q=naruto`

---

### `GET /api/anime/:id`
Full anime info by slug-ID.

**Example:** `/api/anime/one-piece-odmau`

---

### `GET /api/anime/:id/episodes`
Full episode list for an anime.

**Example:** `/api/anime/one-piece-odmau/episodes`

---

### `GET /api/anime/:id/next-episode-schedule`
Next episode air date & time.

**Example:** `/api/anime/one-piece-odmau/next-episode-schedule`

---

### `GET /api/episode/servers`
| Query param | Required | Description |
|---|---|---|
| `animeEpisodeId` | ✅ | Episode ID e.g. `one-piece-odmau?ep=12345` |

**Example:** `/api/episode/servers?animeEpisodeId=one-piece-odmau?ep=12345`

---

### `GET /api/episode/sources`
| Query param | Required | Description |
|---|---|---|
| `animeEpisodeId` | ✅ | Episode ID |
| `server` | ❌ | Server name (default: `vidstreaming`) |
| `category` | ❌ | `sub` \| `dub` \| `raw` (default: `sub`) |

**Example:** `/api/episode/sources?animeEpisodeId=one-piece-odmau?ep=12345&server=vidstreaming&category=sub`

Response includes `sources` (M3U8 URLs), `subtitles`, `headers`, `intro`, `outro`.

---

### `GET /api/category/:name`
| URL param | Options |
|---|---|
| `name` | `most-popular`, `top-airing`, `most-favorite`, `completed`, `recently-updated`, `recently-added`, `top-upcoming`, `subbed-anime`, `dubbed-anime`, `latest-completed`, `trending` |

| Query param | Description |
|---|---|
| `page` | Page number (default: 1) |

**Example:** `/api/category/top-airing?page=1`

---

### `GET /api/genre/:name`
| URL param | Example values |
|---|---|
| `name` | `action`, `romance`, `fantasy`, `isekai`, `shounen` … |

**Example:** `/api/genre/action?page=2`

---

### `GET /api/producer/:name`
**Example:** `/api/producer/mappa?page=1`

---

### `GET /api/azlist/:sortOption`
| URL param | Options |
|---|---|
| `sortOption` | `all`, `other`, `a`, `b`, `c` … `z`, `0-9` |

**Example:** `/api/azlist/all?page=1`

---

### `GET /api/schedule`
| Query param | Required | Description |
|---|---|---|
| `date` | ✅ | `YYYY-MM-DD` |
| `tzOffset` | ❌ | Timezone offset in minutes (default: `-330` = IST) |

**Example:** `/api/schedule?date=2025-04-29&tzOffset=0`

---

### `GET /api/qtip/:animeId`
Quick popup info for hover cards.

**Example:** `/api/qtip/one-piece-odmau`

---

## 🗂 Project Structure

```
hianime-api/
├── api/
│   └── index.js        ← Single Vercel serverless function
├── .env.example        ← Environment variable template
├── .gitignore
├── package.json
├── vercel.json         ← Vercel config (rewrites + headers)
└── README.md
```

## ⚙️ How It Works

All routes rewrite to `api/index.js` via `vercel.json`. The handler parses the path manually — no framework, no overhead. The `aniwatch` package handles all scraping against hianime.to.

## 📝 License

MIT
