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

### 2. Anime Endpoints (`/api/v1/anime`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/anime` | Search, filter, and paginate through anime titles |
| `GET` | `/api/v1/anime/random` | Pick a random anime (optional filter by type or min_score) |
| `GET` | `/api/v1/anime/by-provider/:provider/:providerId` | Lookup anime by external provider ID |
| `GET` | `/api/v1/anime/:id` | Full details for an anime by its `anisora_id` |
| `GET` | `/api/v1/anime/:id/relations` | Direct prequels, sequels, and related anime |

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
- `sort_by`: Sort field (`score_mean`, `score_agm`, `season_year`, `title`, `episodes`)
- `sort_order`: `desc` or `asc` (default: `desc`)
- `page`: Page number (default: `1`)
- `limit`: Records per page (default: `20`, max: `100`)

#### Supported External Providers:
- `mal` (MyAnimeList)
- `anilist` (AniList)
- `kitsu` (Kitsu)
- `hianime` (HiAnime)
- `miruro` (Miruro)
- `animeplanet` (AnimePlanet)
- `anidb` (AniDB)
- `anisearch` (AniSearch)
- `simkl` (Simkl)
- `livechart` (LiveChart)
- `animecountdown` (AnimeCountdown)
- `ann` (AnimeNewsNetwork)

### 3. Metadata Endpoints (`/api/v1/meta`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/meta/tags` | List all tags/genres sorted by frequency with pagination & search |
| `GET` | `/api/v1/meta/studios` | List animation studios sorted by frequency |
| `GET` | `/api/v1/meta/producers` | List production companies sorted by frequency |
| `GET` | `/api/v1/meta/stats` | Aggregated breakdown by format, status, and season |

---

## 💡 BigInt & Decimal Serialization

PostgreSQL stores primary IDs (`anisora_id`, `anilist_id`, etc.) as 64-bit BigInts and scores/duration as Decimals.  
In Node.js, `JSON.stringify` throws a `TypeError` on native `BigInt` values.

This project implements a clean polyfill layer in [`src/db/prisma.ts`](file:///a:/anisora-db-api/src/db/prisma.ts):
- `BigInt.prototype.toJSON = function() { return this.toString(); }`
- `Prisma.Decimal.prototype.toJSON = function() { return Number(this.toString()); }`
- External IDs and AniSora IDs are presented as strings to eliminate any precision loss in JavaScript clients.
