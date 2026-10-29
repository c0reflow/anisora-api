# AniSora Anime Database REST API

A high-performance, production-ready REST API built with **Node.js**, **TypeScript**, **Fastify**, **Prisma ORM**, **PostgreSQL** (Neon Serverless), **TypeBox**, and **OpenAPI / Swagger**.

The API indexes **41,908+ anime titles** with cross-provider ID mapping (MyAnimeList, AniList, Kitsu, HiAnime, Miruro, AnimePlanet, AniDB, AniSearch, Simkl, LiveChart, AnimeCountdown, AnimeNewsNetwork), relationships, studios, producers, and genres.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Runtime** | Node.js (v20+) | Event-driven JavaScript runtime |
| **Language** | TypeScript (v5+) | Strict type-safety across schemas and database models |
| **API Framework** | Fastify (v5) | Low-overhead web framework for maximum throughput |
| **Database** | PostgreSQL | Hosted on Neon Serverless Postgres |
| **ORM** | Prisma ORM (v6) | Type-safe query engine and schema introspection |
| **Validation** | TypeBox (`@sinclair/typebox`) | Zero-runtime conversion JSON Schema validator with Fastify type provider |
| **Documentation** | OpenAPI 3.0 / Swagger UI | Interactive API documentation at `/docs` |
| **Security** | Helmet, CORS, Rate Limiting | Protected by `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit` |

---

## 📁 Project Architecture

```
anisora-db-api/
├── prisma/
│   └── schema.prisma        # Introspected PostgreSQL schema (anime, relations, tags, etc.)
├── src/
│   ├── config/
│   │   └── env.ts           # Type-safe environment variables and defaults
│   ├── db/
│   │   └── prisma.ts        # PrismaClient singleton with BigInt & Decimal JSON serialization
│   ├── schemas/
│   │   ├── common.schema.ts # Reusable schemas (Pagination, Error, Health)
│   │   ├── anime.schema.ts  # TypeBox schemas for Anime queries, items, and details
│   │   └── meta.schema.ts   # Schemas for tags, studios, producers, and statistics
│   ├── services/
│   │   ├── anime.service.ts # Core business logic for search, filters, relations, and providers
│   │   └── meta.service.ts  # Database aggregations for tags, studios, and stats
│   ├── plugins/
│   │   ├── swagger.plugin.ts  # OpenAPI 3.0 specification & Swagger UI
│   │   └── security.plugin.ts # CORS, Helmet headers, and rate limiting
│   ├── routes/
│   │   ├── health.routes.ts # /health endpoint with database ping
│   │   ├── anime.routes.ts  # /api/v1/anime endpoints
│   │   └── meta.routes.ts   # /api/v1/meta endpoints
│   ├── app.ts               # Fastify application factory
│   └── server.ts            # Server bootstrap and graceful shutdown handlers
├── .env                     # Local environment secrets
├── .env.example             # Example environment file template
├── package.json             # NPM package scripts and dependencies
├── tsconfig.json            # TypeScript compiler configuration
└── test-api.ts              # Automated integration test suite
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20 or newer
- **npm**: v10 or newer

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` (or configure your Neon PostgreSQL database URL):

```ini
DATABASE_URL="postgresql://neondb_owner:npg_xZ1YEFuap8Cz@ep-young-darkness-b3yysxxr-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
API_PREFIX=/api/v1
CORS_ORIGIN=*
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW="1 minute"
```

### 4. Run Development Server
```bash
npm run dev
```
The API server will start at `http://localhost:3000`.

### 5. Interactive Swagger Documentation
Open your browser and navigate to:
👉 **[http://localhost:3000/docs](http://localhost:3000/docs)**

---

## 📜 Available NPM Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts server in watch mode with `tsx` and pretty logs |
| `npm run build` | Generates Prisma client and compiles TypeScript to `./dist` |
| `npm start` | Runs the compiled production server from `./dist/server.js` |
| `npm test` | Runs end-to-end integration tests across all API endpoints |
| `npm run prisma:generate` | Re-generates Prisma Client types |
| `npm run prisma:pull` | Re-introspects schema from the PostgreSQL database |
| `npm run prisma:studio` | Opens visual GUI to browse the PostgreSQL database |

---

## 📡 API Endpoints Reference

### 1. Health & Diagnostics
- `GET /health`  
  Checks API status and PostgreSQL connection, returning total anime count.

### 2. Search & Autocomplete Endpoints

#### `GET /search` (or `/api/v1/search`)
Fast search by anime name with the exact requested fields:
- **Query Parameters**:
  - `query` or `q`: Keyword to search by anime name or synonyms
  - `page`: Page number (default: `1`)
  - `limit`: Items per page (default: `20`)
- **Response Format**:
  ```json
  {
    "data": [
      {
        "id": "704261250",
        "title": "Naruto: Shippuuden",
        "total_episodes": 500,
        "poster": "https://cdn.myanimelist.net/images/anime/1565/111305.jpg",
        "description": null,
        "type": "series",
        "duration": "23m",
        "score": 8.21,
        "tag": "action"
      }
    ],
    "pagination": {
      "total": 48,
      "page": 1,
      "limit": 20,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```

#### `GET /searchsuggestion` (or `/api/v1/searchsuggestion`)
Ultra-fast, lightweight search suggestions returning **only the top 5 matches**:
- **Query Parameters**:
  - `query` or `q`: Search prefix or keyword
- **Response Format**:
  ```json
  {
    "query": "naruto",
    "suggestions": [
      {
        "id": "704261250",
        "title": "Naruto: Shippuuden",
        "poster": "https://cdn.myanimelist.net/images/anime/1565/111305.jpg",
        "type": "series",
        "score": 8.21,
        "year": 2007,
        "tag": "action"
      }
    ]
  }
  ```

#### ⚡ Real-Time WebSocket Autocomplete
Connect via WebSocket at:
- `ws://localhost:3000/searchsuggestion/ws` (or `ws://localhost:3000/api/v1/searchsuggestion/ws`)
- **Send**: `{"query": "attack"}` or plain text `"attack"`
- **Receive**: Instant JSON response with top 5 suggestions as you type with zero HTTP overhead.

---

### 3. Curated Daily Home Page (`/home`)

An all-in-one endpoint designed for front-end home screens (inspired by modern streaming platforms like HiAnime and AniWatch).
The complete home payload is assembled once, stored as a single JSON document in the PostgreSQL `home` table, and served directly with sub-10ms response times.

#### Available Routes:
- `GET /home` (or `/api/v1/home`): Fetches the daily cached home payload.
- `GET /home?update=true` (or `/home&update` / `POST /home/sync`): Synchronizes fresh data from AniList & local DB, saves to PostgreSQL `home` table, and returns the newly synced data. **Requires Admin Bearer Token** (`Authorization: Bearer <ADMIN_API_KEY>`).

#### Sections Included in Home Response:
1. **Spotlight (`spotlight`)**: Top 15 featured anime with high-resolution **backdrop banners** (instead of posters), ranking badges (`#1 Spotlight`), format & release date (`TV Oct 5, 2026 HD`), sub/dub badges (`sub_episodes: 10, dub_episodes: 9`), full descriptions, scores, and genres.
2. **Trending (`trending`)**: Top 20 trending anime resolved against our local database.
3. **Top Airing (`top_airing`)**: Top 20 currently airing TV anime.
4. **Most Popular (`most_popular`)**: Top 20 anime sorted by total views.
5. **Most Favorite (`most_favorite`)**: Top 20 anime sorted by total likes.
6. **Latest Completed (`latest_completed`)**: Top 20 recently finished series.
7. **Genres (`genres`)**: Top 30 genres/tags with total anime counts.
8. **Latest Episode (`latest_episodes`)**: Recently aired episodes with `episode_id` formatted as `AnisoraId&ep=int`.
9. **New On AniSora (`new_on_anisora`)**: Recently added titles in the AniSora database.
10. **Estimated Schedule (`estimated_schedule`)**: Complete airing schedule for today.
11. **Top 10 (`top_10`)**: Ranked 1-to-10 anime leaderboard for the week.
12. **Top Upcoming (`top_upcoming`)**: Top upcoming releases.
13. **Latest Comments (`latest_comments`)**: Recent user discussions across episodes with resolved anime titles.
14. **Updated Timestamp (`updated_at`)**: ISO 8601 timestamp when home data was last synced.

#### Example Spotlight Item:
```json
{
  "id": "195539",
  "rank": 1,
  "spotlight_badge": "#1 Spotlight",
  "title": "Cyberpunk: Edgerunners 2",
  "banner": "https://s4.anilist.co/file/anilistcdn/media/anime/banner/195539-lO5SUdp4SOrq.jpg",
  "poster": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx195539-4LdfmKIHzuxr.png",
  "description": "Cyberpunk: Edgerunners 2 pulls you back into Night City, where lives become entangled to the extreme...",
  "type": "ONA",
  "release_date": "Oct 20, 2026",
  "quality": "HD",
  "episodes": {
    "sub": 10,
    "dub": 9,
    "total": 10
  },
  "sub_episodes": 10,
  "dub_episodes": 9,
  "total_episodes": 10,
  "score": 8.4,
  "tags": ["Action", "Drama", "Sci-Fi"]
}
```

#### Admin Sync Command Example:
```bash
curl -X GET "http://localhost:3000/home?update=true" \
  -H "Authorization: Bearer anisora_admin_secret_key_2026"
```

---

### 4. Catalog & Discovery Endpoints

Every discovery endpoint returns standardized anime item objects with fields:
`id` (AniSora ID), `title`, `total_episodes`, `poster`, `description`, `type` (`movie` or `series`), `duration`, `score`, and `tag`.

All endpoints are accessible both directly at the root (e.g. `/trending`) and with the API prefix (e.g. `/api/v1/trending`).

| Method | Endpoint | Source / Strategy | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/trending`<br>`/tranding` | AniList + Local DB | Fetches AniList trending IDs via GraphQL, resolves corresponding anime in our local PostgreSQL database with in-memory caching (30m TTL) and local DB fallback |
| `GET` | `/top-airing` | Local PostgreSQL | Ongoing TV anime series sorted by score |
| `GET` | `/most-popular` | Local PostgreSQL | Anime titles ordered by total views (`anime.views DESC`) |
| `GET` | `/most-favorite` | Local PostgreSQL | Anime titles ordered by total likes (`anime.likes DESC`) |
| `GET` | `/latest-completed` | Local PostgreSQL | Recently finished anime series sorted by latest season and score |
| `GET` | `/top-upcoming` | Local PostgreSQL | Upcoming scheduled anime releases |
| `GET` | `/top-ten`<br>`/top-10` | Local PostgreSQL | Top 10 anime leaderboard for `week`, `month`, or `year` (`?period=week\|month\|year`) |
| `GET` | `/latest-episodes`<br>`/latest-episode` | AniList + Local DB | Recently aired anime episodes mapped with episode IDs formatted as `AnisoraId&ep=int` |
| `GET` | `/schedule` | AniList + Local DB | Estimated airing schedule for a given date (`?date=YYYY-MM-DD`, defaults to today) |
| `GET` | `/az-list` | Local PostgreSQL | Alphabetical catalog filter (`?letter=A`, `B`..`Z`, `0-9`, or `other`) |
| `GET` | `/genres` | Local PostgreSQL | List all available genres/tags with total anime counts |
| `GET` | `/genre/:genre` | Local PostgreSQL | Filter catalog by specific genre name (e.g. `/genre/action`) |
| `GET` | `/movie`<br>`/movies` | Local PostgreSQL | Full movies list without any external AniList overhead |
| `GET` | `/ova` | Local PostgreSQL | Original Video Animations (OVA) without external overhead |
| `GET` | `/ona` | Local PostgreSQL | Original Net Animations (ONA) without external overhead |
| `GET` | `/special` | Local PostgreSQL | Anime specials without external overhead |
| `GET` | `/episodes/:id` | Local PostgreSQL | Returns all episode IDs for an anime formatted as `AnisoraId&ep=int` (e.g., `199918116&ep=1` through `199918116&ep=24`) |

#### Example: Latest Episodes Response (`GET /latest-episodes`)
```json
{
  "data": [
    {
      "id": "293894609",
      "episode_id": "293894609&ep=5",
      "episode_number": 5,
      "title": "Tensei Kizoku, Kantei Skill de Nariagaru 3rd Season",
      "poster": "https://cdn.myanimelist.net/images/anime/1000/12345.jpg",
      "type": "series",
      "duration": "24m",
      "score": 7.42,
      "tag": "fantasy",
      "airing_at": "2026-10-25T14:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

#### Example: Get Episodes by AniSora ID (`GET /episodes/800630028`)
```json
{
  "anisora_id": "800630028",
  "title": "Black Clover Season 2",
  "jname": "Black Clover 2nd Season",
  "romaji": "Black Clover 2nd Season",
  "total_episodes": 170,
  "episodes": [
    {
      "episode_id": "800630028&ep=1",
      "episode_number": 1,
      "title": "Episode 1 - Asta and Yuno",
      "name": "Asta and Yuno",
      "thumbnail": "https://img1.ak.crunchyroll.com/i/spire4-tmb/8a285ca29aadb33852da5f78d661afc91507016863_full.jpg",
      "duration": "23m",
      "url": "http://www.crunchyroll.com/watch/G6NVVXP8Y/asta-and-yuno",
      "site": "Crunchyroll"
    },
    {
      "episode_id": "800630028&ep=170",
      "episode_number": 170,
      "title": "Episode 170 - The Faraway Future",
      "name": "The Faraway Future",
      "thumbnail": "https://img1.ak.crunchyroll.com/i/spire1-tmb/c9f55b9c783014f912486c054c9358cf1617088983_full.jpg",
      "duration": "23m",
      "url": "http://www.crunchyroll.com/watch/GX9UQJQ54/the-faraway-future",
      "site": "Crunchyroll"
    }
  ]
}
```

---

### 5. Anime Endpoints (`/api/v1/anime`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/anime` | Search, filter, and paginate through anime titles |
| `GET` | `/api/v1/anime/random` | Pick a random anime (optional filter by type or min_score) |
| `GET` | `/api/v1/anime/by-provider/:provider/:providerId` | Lookup anime by external provider ID |
| `GET` | `/api/v1/anime/:id` | Full details for an anime by its `anisora_id` |
| `GET` | `/api/v1/anime/:id/relations` | Direct prequels, sequels, and related anime |
| `POST` | `/api/v1/anime/:id/view` | Increment anime view count |
| `POST` | `/api/v1/anime/:id/like` | Increment anime like count |

#### Query Parameters for `GET /api/v1/anime`:
- `q`: Search keyword matching title or synonyms (case-insensitive)
- `type`: Filter by format (`TV`, `MOVIE`, `OVA`, `ONA`, `SPECIAL`, `MUSIC`)
- `status`: Filter by status (`FINISHED`, `ONGOING`, `UPCOMING`)
- `season`: Filter by season (`WINTER`, `SPRING`, `SUMMER`, `FALL`)
- `year`: Filter by release year (e.g. `2024`)
- `tag`: Filter by genre/tag (e.g. `action`, `romance`, `comedy`)
- `studio`: Filter by animation studio (e.g. `mappa`, `kyoto animation`, `bones`)
- `producer`: Filter by producer
- `min_score` / `max_score`: Filter by mean rating score (e.g. `min_score=7.5`)
- `sort_by`: Sort field (`score_mean`, `score_agm`, `season_year`, `title`, `episodes`, `views`, `likes`)
- `sort_order`: `desc` or `asc` (default: `desc`)
- `page`: Page number (default: `1`)
- `limit`: Records per page (default: `20`, max: `100`)

### 6. Episode Comments Endpoints (`/api/v1/comments`)

Comments are mapped by `episode_id` formatted as `animeid&ep=(int)` (e.g., `199918116&ep=1`), supporting both top-level parent discussions and threaded replies.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/comments/:episodeId` | Fetch all comments for an episode (supports pagination and `type=parent\|reply`) |
| `POST` | `/api/v1/comments` | Post a new comment or reply (with `parent_comment_id`) |
| `DELETE` | `/api/v1/comments/:id` | Delete a comment (cascades to all child replies) |

### 7. User Accounts (`/api/v1/users`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/users` | Register a new user account |
| `GET` | `/api/v1/users/:id` | Get public profile by User UUID |
| `GET` | `/api/v1/users` | Paginated list of users |

### 8. Metadata Endpoints (`/api/v1/meta`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/meta/tags` | List all tags/genres sorted by frequency with pagination & search |
| `GET` | `/api/v1/meta/studios` | List animation studios sorted by frequency |
| `GET` | `/api/v1/meta/producers` | List production companies sorted by frequency |
| `GET` | `/api/v1/meta/stats` | Aggregated breakdown by format, status, and season |

### 9. Video Streaming & Player Embeds (`/stream/miruro`)

Real-time streaming (HLS `.m3u8` playlists and direct `.mp4` URLs), iframe embed links, VTT subtitle tracks, and thumbnail storyboard sprites powered by Miruro.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/stream/miruro/servers` | List streaming servers with clean short names (`type = sub` first, then `type = dub`) |
| `GET` | `/api/v1/stream/miruro/servers` | API v1 alias for Miruro server list |
| `GET` | `/stream/miruro` | Real-time video streaming (HLS/MP4), iframe embed, subtitles, and player options |
| `GET` | `/api/v1/stream/miruro` | API v1 alias for video streaming and embeds |
| `GET` | `/stream/universal/servers` | Universal server list combining Miruro (`kiwix`), VidNest (pahe + trio), and ZokoAnime |
| `GET` | `/stream/universal` | Universal streaming and embed endpoint cross-resolving IDs across providers |
| `GET` | `/api/v1/stream/universal` | API v1 alias for universal streaming |
| `GET` | `/stream/universal/getStream` | Proxied universal stream (Aetherr `stream_url` & Upcloud subtitles) |
| `GET` | `/api/v1/stream/universal/getStream` | API v1 alias for proxied universal streaming |

---

#### 1. Miruro Server List Endpoint (`GET /stream/miruro/servers`)

Fetches all available streaming servers for an anime episode, returning each server's clean short `name` and `id` (`animepahe` renamed to `kiwix`, hashed cloudflare to `cloud-2`, `vault-6-direct-2` to `vault-6`, etc.). Results are organized with `type = sub` servers first, followed by `type = dub`, and any others:

##### Query Parameters:
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string` | **Yes** | Miruro identifier, watch URL, or ID with episode query | `ZkbbIfGqvoOrvvss5iQuAlVkW4AaYPxz?ep=1`<br>`https://miruro.to/watch/ZkbbIfGqvoOrvvss5iQuAlVkW4AaYPxz/one-piece?ep=2` |
| `ep` / `episode`| `integer`| No | Episode number (optional, overrides ep from id) | `1` |

##### Request Example:
```bash
curl "http://localhost:5500/stream/miruro/servers?id=ZkbbIfGqvoOrvvss5iQuAlVkW4AaYPxz?ep=1"
```

##### Example Response:
```json
{
  "id": "ZkbbIfGqvoOrvvss5iQuAlVkW4AaYPxz",
  "episode": 1,
  "title": "I'm Luffy! The Man Who's Gonna Be King of the Pirates!",
  "sub": [
    { "id": "kiwix", "name": "kiwix", "type": "sub" },
    { "id": "vidplay", "name": "vidplay", "type": "sub" },
    { "id": "datsav", "name": "datsav", "type": "sub" },
    { "id": "icarus-2", "name": "icarus-2", "type": "sub" },
    { "id": "cloud-2", "name": "cloud-2", "type": "sub" },
    { "id": "vault-6", "name": "vault-6", "type": "sub" },
    { "id": "vault-7", "name": "vault-7", "type": "sub" },
    { "id": "vidstream-1", "name": "vidstream-1", "type": "sub" },
    { "id": "hd-1", "name": "hd-1", "type": "sub" },
    { "id": "cat", "name": "cat", "type": "sub" },
    { "id": "mycloud", "name": "mycloud", "type": "sub" },
    { "id": "vidstream-2", "name": "vidstream-2", "type": "sub" }
  ],
  "dub": [
    { "id": "icarus-1", "name": "icarus-1", "type": "dub" },
    { "id": "cloud-1", "name": "cloud-1", "type": "dub" },
    { "id": "vault-6", "name": "vault-6", "type": "dub" },
    { "id": "vault-7", "name": "vault-7", "type": "dub" },
    { "id": "vidstream-1", "name": "vidstream-1", "type": "dub" },
    { "id": "hd-1", "name": "hd-1", "type": "dub" },
    { "id": "vidplay", "name": "vidplay", "type": "dub" },
    { "id": "vidstream-2", "name": "vidstream-2", "type": "dub" }
  ],
  "raw": [],
  "servers": [
    { "id": "kiwix", "name": "kiwix", "type": "sub" },
    { "id": "vidplay", "name": "vidplay", "type": "sub" },
    { "id": "datsav", "name": "datsav", "type": "sub" },
    { "id": "icarus-2", "name": "icarus-2", "type": "sub" },
    { "id": "cloud-2", "name": "cloud-2", "type": "sub" },
    { "id": "vault-6", "name": "vault-6", "type": "sub" },
    { "id": "vault-7", "name": "vault-7", "type": "sub" },
    { "id": "vidstream-1", "name": "vidstream-1", "type": "sub" },
    { "id": "hd-1", "name": "hd-1", "type": "sub" },
    { "id": "cat", "name": "cat", "type": "sub" },
    { "id": "mycloud", "name": "mycloud", "type": "sub" },
    { "id": "vidstream-2", "name": "vidstream-2", "type": "sub" },
    { "id": "icarus-1", "name": "icarus-1", "type": "dub" },
    { "id": "cloud-1", "name": "cloud-1", "type": "dub" },
    { "id": "vault-6", "name": "vault-6", "type": "dub" },
    { "id": "vault-7", "name": "vault-7", "type": "dub" },
    { "id": "vidstream-1", "name": "vidstream-1", "type": "dub" },
    { "id": "hd-1", "name": "hd-1", "type": "dub" },
    { "id": "vidplay", "name": "vidplay", "type": "dub" },
    { "id": "vidstream-2", "name": "vidstream-2", "type": "dub" }
  ]
}
```

---

#### 2. Streaming & Embeds Endpoint (`GET /stream/miruro`)

##### Query Parameters:
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string` | **Yes** | Miruro identifier, watch URL, or ID with episode query | `ZkbbIfGqvoOrvvss5iQuAlVkW4AaYPxz?ep=1`<br>`https://miruro.to/watch/ZkbbIfGqvoOrvvss5iQuAlVkW4AaYPxz/one-piece?ep=2` |
| `server` | `string` | No | Dedicated server name or slug. When provided, returns dedicated subtitles, thumbnail, streaming, and embed URL for that server | `kiwix`, `vidstream-1`, `hd-1`, `vidplay`, `datsav`, `cloud-2`, `vault-6` |
| `type` | `string` | No | Audio track: `sub` (default) or `dub` | `sub`, `dub` |
| `ep` / `episode`| `integer`| No | Episode number (optional, overrides ep from id) | `2` |

#### General Request (Without `server` parameter):
Returns primary streaming source, embed player URL, subtitles, thumbnails, skipTimes, and all available server options:
```bash
curl "http://localhost:5500/stream/miruro?id=ZkbbIfGqvoOrvvss5iQuAlVkW4AaYPxz?ep=1"
```

#### Dedicated Server Request (With `server={serverId}`):
Returns subtitles, thumbnail, streaming links, and embed player URL specifically for that server:
```bash
curl "http://localhost:5500/stream/miruro?id=ZkbbIfGqvoOrvvss5iQuAlVkW4AaYPxz?ep=2&server=kiwix&type=sub"
```

---

### 10. Universal Streaming & Cross-Provider Servers (`/stream/universal`)

The universal streaming engine resolves anime across multiple streaming backends and catalogs:
- **Miruro**: Direct HLS streaming (`.m3u8`), subtitles, storyboards, skip times, and servers (`kiwix`, `vidstream-1`, `cloud-2`, `vault-6`, `hd-1`, etc.).
- **VidNest AnimePahe**: `https://vidnest.fun/animepahe/{anilistId}/{episode}/{type}` (`vidnest-pahe`).
- **VidNest Trio**: `https://vidnest.fun/anime/{anilistId}/{episode}/{type}?server={aniwave|megaplay|anitaku}` (`aniwave`, `megaplay`, `anitaku`).
- **ZokoAnime**: `https://zokoanime.video/stream/ani/{anilistId}/{episode}/{type}?color=35d5bf` (`zokoanime`).

Cross-resolves anime IDs seamlessly across **MAL**, **AniList**, **HiAnime**, **Miruro**, and **AniSora** using the local database!

#### 1. Universal Server List (`GET /stream/universal/servers`)

##### Query Parameters:
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string` | **Yes** | Anime identifier (AniList ID, MAL ID, AniSora ID, HiAnime slug, or Miruro ID/URL) | `21`, `16498`, `ZkbbIfGqvoOrvvss5iQuAlVkW4AaYPxz?ep=1` |
| `provider` | `string` | No | Identifier source: `anilist`, `mal`, `hianime`, `miruro`, `anisora` (auto-detected if omitted) | `anilist` |
| `ep` / `episode`| `integer`| No | Episode number (default: `1`) | `1` |

##### Request Example:
```bash
curl "http://localhost:5500/stream/universal/servers?provider=anilist&id=21&ep=1"
```

##### Example Response:
```json
{
  "id": "21",
  "anilistId": "21",
  "malId": "21",
  "miruroId": "ZkbbIfGqvoOrvvss5iQuAlVkW4AaYPxz",
  "title": "One Piece",
  "episode": 1,
  "sub": [
    { "id": "kiwix", "name": "kiwix", "type": "sub", "source": "miruro" },
    { "id": "vidplay", "name": "vidplay", "type": "sub", "source": "miruro" },
    { "id": "datsav", "name": "datsav", "type": "sub", "source": "miruro" },
    { "id": "icarus-2", "name": "icarus-2", "type": "sub", "source": "miruro" },
    { "id": "cloud-2", "name": "cloud-2", "type": "sub", "source": "miruro" },
    { "id": "vault-6", "name": "vault-6", "type": "sub", "source": "miruro" },
    { "id": "vault-7", "name": "vault-7", "type": "sub", "source": "miruro" },
    { "id": "vidstream-1", "name": "vidstream-1", "type": "sub", "source": "miruro" },
    { "id": "hd-1", "name": "hd-1", "type": "sub", "source": "miruro" },
    { "id": "cat", "name": "cat", "type": "sub", "source": "miruro" },
    { "id": "mycloud", "name": "mycloud", "type": "sub", "source": "miruro" },
    { "id": "vidstream-2", "name": "vidstream-2", "type": "sub", "source": "miruro" },
    { "id": "vidnest-pahe", "name": "vidnest-pahe", "type": "sub", "source": "vidnest", "embed": "https://vidnest.fun/animepahe/21/1/sub" },
    { "id": "aniwave", "name": "aniwave", "type": "sub", "source": "vidnest", "embed": "https://vidnest.fun/anime/21/1/sub?server=aniwave" },
    { "id": "megaplay", "name": "megaplay", "type": "sub", "source": "vidnest", "embed": "https://vidnest.fun/anime/21/1/sub?server=megaplay" },
    { "id": "anitaku", "name": "anitaku", "type": "sub", "source": "vidnest", "embed": "https://vidnest.fun/anime/21/1/sub?server=anitaku" },
    { "id": "zokoanime", "name": "zokoanime", "type": "sub", "source": "zokoanime", "embed": "https://zokoanime.video/stream/ani/21/1/sub?color=35d5bf" }
  ],
  "dub": [
    { "id": "icarus-1", "name": "icarus-1", "type": "dub", "source": "miruro" },
    { "id": "cloud-1", "name": "cloud-1", "type": "dub", "source": "miruro" },
    { "id": "vault-6", "name": "vault-6", "type": "dub", "source": "miruro" },
    { "id": "vault-7", "name": "vault-7", "type": "dub", "source": "miruro" },
    { "id": "vidstream-1", "name": "vidstream-1", "type": "dub", "source": "miruro" },
    { "id": "hd-1", "name": "hd-1", "type": "dub", "source": "miruro" },
    { "id": "vidplay", "name": "vidplay", "type": "dub", "source": "miruro" },
    { "id": "vidstream-2", "name": "vidstream-2", "type": "dub", "source": "miruro" },
    { "id": "vidnest-pahe", "name": "vidnest-pahe", "type": "dub", "source": "vidnest", "embed": "https://vidnest.fun/animepahe/21/1/dub" },
    { "id": "aniwave", "name": "aniwave", "type": "dub", "source": "vidnest", "embed": "https://vidnest.fun/anime/21/1/dub?server=aniwave" },
    { "id": "megaplay", "name": "megaplay", "type": "dub", "source": "vidnest", "embed": "https://vidnest.fun/anime/21/1/dub?server=megaplay" },
    { "id": "anitaku", "name": "anitaku", "type": "dub", "source": "vidnest", "embed": "https://vidnest.fun/anime/21/1/dub?server=anitaku" },
    { "id": "zokoanime", "name": "zokoanime", "type": "dub", "source": "zokoanime", "embed": "https://zokoanime.video/stream/ani/21/1/dub?color=35d5bf" }
  ],
  "servers": [
    /* All type=sub servers first, followed by all type=dub servers */
  ]
}
```

---

#### 2. Universal Stream & Embed Endpoint (`GET /stream/universal`)

##### Query Parameters:
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string` | **Yes** | Anime identifier (AniList ID, MAL ID, AniSora ID, HiAnime slug, or Miruro ID/URL) | `21`, `16498` |
| `provider` | `string` | No | Provider catalog: `anilist`, `mal`, `hianime`, `miruro`, `anisora` | `anilist` |
| `server` | `string` | No | Dedicated server name: `kiwix`, `zokoanime`, `vidnest-pahe`, `aniwave`, `megaplay`, `anitaku`, `vidstream-1`, `cloud-2`, etc. | `zokoanime` |
| `type` | `string` | No | Audio track: `sub` (default) or `dub` | `sub` |
| `ep` / `episode`| `integer`| No | Episode number (default: `1`) | `1` |

##### Request Examples:

**1. Fetch ZokoAnime Embed Player:**
```bash
curl "http://localhost:5500/stream/universal?provider=anilist&id=21&ep=1&server=zokoanime"
```

**2. Fetch VidNest Aniwave Embed Player:**
```bash
curl "http://localhost:5500/stream/universal?provider=anilist&id=21&ep=1&server=aniwave"
```

**3. Fetch VidNest AnimePahe Embed Player:**
```bash
curl "http://localhost:5500/stream/universal?provider=anilist&id=21&ep=1&server=vidnest-pahe"
```

**4. Fetch Kiwix (AnimePahe via Miruro) Direct HLS Streams:**
```bash
curl "http://localhost:5500/stream/universal?provider=anilist&id=21&ep=1&server=kiwix"
```

**5. General Request with Default Streams and All Server Choices:**
```bash
curl "http://localhost:5500/stream/universal?provider=anilist&id=21&ep=1"
```

---

#### 3. Proxied Universal Stream Endpoint (`GET /stream/universal/getStream`)

Proxies direct video streams and subtitle tracks through our dedicated high-performance local proxy server (`/proxy`):
- **Streaming Proxy (Localhost HLS Proxy)**: Formats upstream HLS `.m3u8` streams via `http://localhost:5050/proxy?url=...&auto=0&headers=...`. The local proxy server dynamically rewrites all playlist and segment lines so that the browser never encounters 403 Forbidden or CORS issues.
- **Subtitle & Asset Proxy**: Subtitle tracks (`.vtt`) and thumbnail sprites are also routed through the local proxy, eliminating external third-party proxy downtime and rate limits.
- **Automatic 403 & Fallback Recovery**: If an upstream server (such as Kiwix/AnimePahe via `uwucdn.top`) rejects requests with a 403 Forbidden Cloudflare challenge, the service automatically falls back to healthy direct streams (`zokoanime`, `vidstream-1`, `icarus-2`, `cloud-2`, `hd-1`, `cat`, `mycloud`) ensuring uninterrupted playback.

##### Running the Local Proxy:
```bash
# Start standalone proxy on port 5050
npm run proxy
# or
node proxy/server.js
```

##### Query Parameters:
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string` | **Yes** | Anime identifier (AniList ID, MAL ID, AniSora ID, HiAnime slug, or Miruro ID/URL) | `21`, `16498` |
| `provider` | `string` | No | Provider catalog: `anilist`, `mal`, `hianime`, `miruro`, `anisora` | `anilist` |
| `server` | `string` | No | Dedicated server name: `zokoanime`, `vidstream-1`, `cloud-2`, `hd-1`, `cat`, `mycloud`, `kiwix` | `zokoanime` |
| `type` | `string` | No | Audio track: `sub` (default) or `dub` | `sub` |
| `ep` / `episode`| `integer`| No | Episode number (default: `1`) | `1` |

##### Request Examples:

**1. Fetch Proxied Stream with ZokoAnime:**
```bash
curl "http://localhost:5500/stream/universal/getStream?provider=anilist&id=21&ep=1&server=zokoanime"
```

**2. Fetch Proxied Stream with Default Universal Server:**
```bash
curl "http://localhost:5500/stream/universal/getStream?provider=anilist&id=21&ep=1"
```

##### Sample Response:
```json
{
  "id": "21",
  "anilistId": "21",
  "miruroId": "ZkbbIfGqvoOrvvss5iQuAlVkW4AaYPxz",
  "title": "One Piece",
  "episode": 1,
  "type": "sub",
  "server": "zokoanime",
  "serverId": "zokoanime",
  "provider": "zokoanime",
  "stream_url": "http://localhost:5050/proxy?url=https%3A%2F%2Fhls.dramahot.top%2Fp%2Fscxqicy%2Fta9t4m1bhw%2Fcm72fkvbpx%2F09qmw7k6mi5nzd%2Fmaster.m3u8&auto=0&headers=%7B%22Referer%22%3A%22https%3A%2F%2Fzokoanime.video%22%2C%22Origin%22%3A%22https%3A%2F%2Fzokoanime.video%22%2C%22User-Agent%22%3A%22Mozilla%2F5.0...%22%7D",
  "target_url": "https://hls.dramahot.top/p/scxqicy/ta9t4m1bhw/cm72fkvbpx/09qmw7k6mi5nzd/master.m3u8",
  "stream_path": null,
  "expiry_date": null,
  "streaming": [
    {
      "url": "http://localhost:5050/proxy?url=https%3A%2F%2Fhls.dramahot.top%2Fp%2Fscxqicy%2Fta9t4m1bhw%2Fcm72fkvbpx%2F09qmw7k6mi5nzd%2Fmaster.m3u8&auto=0&headers=%7B%22Referer%22%3A%22https%3A%2F%2Fzokoanime.video%22%2C%22Origin%22%3A%22https%3A%2F%2Fzokoanime.video%22%2C%22User-Agent%22%3A%22Mozilla%2F5.0...%22%7D",
      "stream_url": "http://localhost:5050/proxy?url=https%3A%2F%2Fhls.dramahot.top%2Fp%2Fscxqicy%2Fta9t4m1bhw%2Fcm72fkvbpx%2F09qmw7k6mi5nzd%2Fmaster.m3u8&auto=0&headers=%7B%22Referer%22%3A%22https%3A%2F%2Fzokoanime.video%22%2C%22Origin%22%3A%22https%3A%2F%2Fzokoanime.video%22%2C%22User-Agent%22%3A%22Mozilla%2F5.0...%22%7D",
      "original_url": "https://hls.dramahot.top/p/scxqicy/ta9t4m1bhw/cm72fkvbpx/09qmw7k6mi5nzd/master.m3u8",
      "format": "hls",
      "quality": "auto",
      "embed": null
    }
  ],
  "embed": "https://zokoanime.video/stream/ani/21/1/sub?color=35d5bf",
  "subtitles": [
    {
      "language": "en",
      "label": "English",
      "file": "http://localhost:5050/proxy?url=https%3A%2F%2Fhls.dramahot.top%2Fv%2Fscxqicy%2Fta9t4m1bhw%2Fcm72fkvbpx%2F09qmw7k6mi5nzd%2Fsubs%2F6e4a0p3k8ehe9eee.vtt&headers=%7B%22User-Agent%22%3A%22Mozilla%2F5.0...%22%2C%22Referer%22%3A%22https%3A%2F%2Fzokoanime.video%22%7D",
      "original_file": "https://hls.dramahot.top/v/scxqicy/ta9t4m1bhw/cm72fkvbpx/09qmw7k6mi5nzd/subs/6e4a0p3k8ehe9eee.vtt",
      "format": "vtt",
      "default": true
    }
  ],
  "thumbnail": null,
  "headers": {
    "Referer": "https://zokoanime.video",
    "Origin": "https://zokoanime.video",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  },
  "skipTimes": [
    { "kind": "intro", "start": 31, "end": 111 },
    { "kind": "outro", "start": 1376, "end": 1447 }
  ],
  "defaultServer": "zokoanime"
}
```

---

#### 4. Video.js Studio Player UI (`/player` or `/player.html`)

A standalone web player featuring the **VidHawk Custom Skin** integrated with Video.js and Hls.js:

- **Input Control Dashboard**:
  - **Video / HLS Stream URL**: Accepts `.m3u8` playlists (e.g. from `/stream/universal/getStream`) or direct `.mp4` video files.
  - **Subtitle URL**: WebVTT / SRT subtitle files.
  - **Thumbnail Preview VTT**: WebVTT sprite sheet for frame-accurate seekbar hover thumbnails.
  - **Title & Episode**: Configures player header displays.
  - **Intro / Outro Timers**: Displays yellow intro/outro segments on the seekbar and shows glowing **SKIP INTRO** / **SKIP OUTRO** buttons during playback.
  - **⚡ Quick AniSora API Fetcher**: Enter anime ID (e.g. `21`), episode number, and server name to automatically fetch, configure, and play directly via `/stream/universal/getStream`.
  - **Instant Presets**: One-click sample streams (One Piece Ep 1, ZokoAnime Dramahot HLS, Sintel Open Movie, Big Buck Bunny).
- **Player Skin Highlights**:
  - Top-left floating "NOW PLAYING" and anime title.
  - Top-right Cloud Server switcher menu (HiAnime, Miruro, VidNest).
  - YouTube-style double-click seek ripples (◀◀◀ / ▶▶▶ &plusmn;10s).
  - Seekbar with yellow intro/outro ranges, buffer indicators, and hover thumbnail canvas preview.
  - Bottom controls with capsule pills: Play/Pause, collapsible horizontal volume slider, formatted time, Cast, CC toggle (distinct ON/OFF SVGs in white), PiP, and Fullscreen.
  - Settings popover: Quality (1080p, 720p, 480p, Auto), Playback speed, Captions with visual customizer (font size, color, background, edge style), Player toggles (Auto-skip intro/outro, video fit), and download options.
  - Right-click Context Menu: Loop toggle, Copy URL, Copy URL @ timestamp, and **Stats for Nerds** overlay with live buffer health gauge.
  - Keyboard Hotkeys: Space/K, M, F, Arrow keys.

---

## 🏷️ Title Localization & Default Names

To provide an optimal client experience, AniSora maps and stores English titles as the primary display `title` and retains the Japanese Romaji name under `jname` (and `romaji`):

### `default_name` PostgreSQL Table
```sql
CREATE TABLE default_name (
    anisora_id BIGINT PRIMARY KEY REFERENCES anime(anisora_id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,          -- English title (e.g., "Attack on Titan")
    jname VARCHAR(500) NOT NULL,         -- Japanese Romaji name (e.g., "Shingeki no Kyojin")
    hianime_id VARCHAR(191)              -- HiAnime catalog identifier
);
```

### Title Resolution Logic
1. If the anime has a `hianime_id`, it is matched against the HiAnime catalog:
   - `title` is set to the English `name` (e.g., `"Attack on Titan"`).
   - `jname` and `romaji` are set to the Japanese Romaji name (e.g., `"Shingeki no Kyojin"`).
2. If `hianime_id` is missing or unindexed, it safely falls back to the original database title.
3. All search endpoints (`/search`, `/searchsuggestion`, `/api/v1/anime?q=...`) index both `name`, `jname`, `title`, and synonyms simultaneously so queries in either English or Romaji return accurate results.

---

## 💡 BigInt & Decimal Serialization

PostgreSQL stores primary IDs (`anisora_id`, `anilist_id`, etc.) as 64-bit BigInts and scores/duration as Decimals.  
In Node.js, `JSON.stringify` throws a `TypeError` on native `BigInt` values.

This project implements a clean polyfill layer in [`src/db/prisma.ts`](file:///a:/anisora-db-api/src/db/prisma.ts):
- `BigInt.prototype.toJSON = function() { return this.toString(); }`
- `Prisma.Decimal.prototype.toJSON = function() { return Number(this.toString()); }`
- External IDs and AniSora IDs are presented as strings to eliminate any precision loss in JavaScript clients.

#   a n i s o r a - a p i  
 