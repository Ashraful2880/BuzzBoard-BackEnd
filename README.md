# BuzzBoard Server — AI-Powered Publishing & Ad-Tech API

**BuzzBoard Server** is a production-ready RESTful backend for technical publishing, AI editorial intelligence, Google OAuth 2.0 authentication, and direct ad-tech monetization. Built with **Node.js, Express 5, PostgreSQL, Prisma ORM, and Google Gemini / OpenAI**.

- **Live API**: `https://buzzboard-backend.onrender.com`
- **Interactive Docs**: `GET /api/v1/docs` · **Health Check**: `GET /api/v1/health`

---

## Key Engineering Features

- **PostgreSQL + Prisma ORM with Composite Indexing**:
  - Relational schema (`User`, `Post`, `Series`, `Comment`, `PostLike`, `CommentLike`, `Bookmark`, `Follow`, `Notification`, `AdCampaign`, `Newsletter`) with composite indexes on hot query paths (`[status, scheduledAt]`, `[seriesId, seriesOrder]`, `[isAdSafe, status, createdAt]`, `[status, placement, endDate]`, `[userId, createdAt]`, `[followingId]`).
- **Authentication & Google OAuth 2.0 (`/api/v1/auth`)**:
  - Email/password auth (`bcryptjs` + JWT) and native `fetch`-based **Google OAuth 2.0** flow (`/google`, `/google/callback`) with automatic user provisioning and `trust proxy` support for HTTPS deployments on Render.
  - Profile management (`GET /profile`, `PUT /profile`) with Multer + Cloudinary image upload (and automatic `/uploads` local disk fallback).
- **AI Content Intelligence (`/api/v1/ai`)**:
  - Powered by **Google Gemini (`gemini-2.5-flash` / `gemini-2.0-flash`)** and **OpenAI (`gpt-4o-mini`)** with deterministic NLP fallback:
    - Auto-SEO metadata & tag generation
    - AI Writing Co-Pilot (`improve`, `expand`, `outline`, `grammar`, `tone`)
    - Cached 1-click TL;DR article summaries
    - Contextual reader Q&A & bilingual translation (`en` ↔ `bn`)
    - Brand-safety & AdSense policy compliance checks
- **Optimized Ad-Tech & Monetization (`/api/v1/ads`, `/api/v1/analytics`)**:
  - Eliminated N+1 impression updates using batch `updateMany` with atomic `{ increment: 1 }` operations and race-free click/CTR tracking.
  - Creator telemetry (views, engagement rate, ad-safe readiness, top posts) and campaign revenue analytics.
- **Security & Resilience**:
  - Security headers, recursive input sanitization, IP-based rate limiting, centralized Prisma/JWT error middleware, and throttled scheduled-post publishing.

---

## System Architecture

```mermaid
flowchart TD
    Client["BuzzBoard React Client (Vercel)"] --> Proxy["Render HTTPS Proxy (trust proxy)"]
    Proxy --> Security["Security Headers + Sanitizer + Rate Limiter"]
    Security --> Router["Express 5 Router (/api/v1)"]

    Router --> Auth["Auth, JWT & Google OAuth 2.0"]
    Router --> Posts["Posts, Series, Slugs & Scheduled Publishing"]
    Router --> Engage["Comments, Likes, Bookmarks & Follow Graph"]
    Router --> AI["AI Co-Pilot, SEO, TL;DR, Q&A & Translation"]
    Router --> Ads["Ad-Tech Engine (Batch Impressions, Atomic Clicks & Analytics)"]

    Auth & Posts & Engage & AI & Ads --> DB[("PostgreSQL (Neon) + Prisma ORM")]
    Auth & Posts --> Media["Cloudinary / Local /uploads Fallback"]
    AI --> LLM["Google Gemini / OpenAI + NLP Fallback"]
```

---

## API Modules (`/api/v1`)

| Module | Base Path | Highlights |
| :--- | :--- | :--- |
| **Auth & OAuth** | `/api/v1/auth` | `POST /register`, `POST /login`, `GET /google`, `GET /google/callback`, `GET/PUT /profile` |
| **Posts** | `/api/v1/posts` | CRUD, slug lookup, category/search/ad-safe filters, likes, reactions, live readers, AI summary |
| **Series** | `/api/v1/series` | Create & browse structured multi-part technical series |
| **Comments** | `/api/v1/comments`, `/api/v1/posts/:postId/comments` | Nested replies, comment likes, edit/delete |
| **Users** | `/api/v1/users` | Bookmarks (`GET/POST /bookmarks`), follow graph (`POST /:id/follow`), public author profile (`GET /:id/profile`) |
| **AI Intelligence** | `/api/v1/ai` | `POST /generate-seo`, `POST /assist`, `POST /moderate`, `POST /ask/:id`, `POST /translate/:id` |
| **Ads & Analytics** | `/api/v1/ads`, `/api/v1/analytics` | Active ad serving, click tracking, campaign CRUD, creator & monetization analytics |
| **SEO & Newsletter** | `/api/v1/seo`, `/api/v1/newsletter` | Trending posts, dynamic sitemap, newsletter subscription |

---

## Getting Started

### Prerequisites
- Node.js `v18+` (recommended `v20+`)
- PostgreSQL database (local or [Neon.tech](https://neon.tech))

### Local Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure `.env`** (see `.env.example`):
   ```env
   NODE_ENV=development
   PORT=5000
   FRONTEND_URL=http://localhost:3000
   DATABASE_URL="postgresql://user:password@host/buzzboard_db?sslmode=require"
   JWT_SECRET=your_super_secret_jwt_key
   JWT_EXPIRES_IN=30d

   # Google OAuth 2.0
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

   # AI Providers (Optional)
   GOOGLE_GEMINI_API_KEY=your_google_gemini_api_key
   OPENAI_API_KEY=your_openai_api_key
   ```

3. **Generate Prisma Client & push schema**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run server & tests**
   ```bash
   npm run dev    # Development with nodemon
   npm start      # Production
   npm test       # Run API test suite (node tests/api.test.js)
   ```
