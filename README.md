## FB Rental Finder

A tiny Next.js app that filters Facebook group posts for what you care about (e.g. *annex, 2 rooms, kitchen in Malabe*) and shows the matching posts with their original FB links.

The scraping is split from the frontend on purpose:

```
GitHub Actions (every 5h)    Vercel (frontend)
  Playwright scraper    ──>    Next.js UI
        │                        │
        └──── data/*.json ◄──────┘   (committed to repo by the cron)
```

This keeps everything on free tiers.

### Phases

- **Phase 1 (done)** — UI scaffold with multi-select for locations / keywords / groups, results view, all on mock data.
- **Phase 2 (done)** — JSON-file persistence + API routes (`/api/groups`, `/api/posts`, `/api/profile`), Playwright scraper script, GitHub Actions workflow for the 5h cron.
- **Phase 3 (when ready to deploy)** — swap the JSON store for Neon Postgres so the live Vercel deployment can also accept group/profile edits (see "Going to production" below).

---

### Run it locally

```sh
npm install
npm run dev
# open http://localhost:3000
```

Settings (locations, keywords, groups) are saved to `data/*.json` next to the project, so they survive restarts.

### Run the scraper locally

One-time browser install:

```sh
npm run scrape:install-browser
```

Get your Facebook session cookies (use a **secondary FB account** — there's a small ToS/ban risk):
1. Log into facebook.com in a browser as your secondary account.
2. Install the "Cookie-Editor" extension (or any cookie exporter).
3. On facebook.com, click "Export → JSON". You get an array like `[{"name":"c_user", ...}, ...]`.
4. Create `.env.local` in the project root:
   ```
   FB_COOKIES='<paste the JSON here on one line>'
   ```

Then:

```sh
npm run scrape
```

The script logs each group it visits, how many posts it found, and how many were new. New posts are appended (deduped by FB post ID) to `data/posts.json`. Refresh the UI to see them.

> Tip: the scraper account must be a **member** of every group you want to scrape.

### Automate with GitHub Actions

`.github/workflows/scrape.yml` is already set up to run the scraper every 5 hours. To enable it:

1. Push this repo to GitHub.
2. Repo → Settings → Secrets and variables → Actions → "New repository secret".
   - **Name**: `FB_COOKIES`
   - **Value**: the same JSON you put in `.env.local`.
3. The first run will be on the next 5-hour mark. Trigger manually any time with "Actions → Scrape FB groups → Run workflow".

The workflow commits the updated `data/posts.json` back to the repo. If you've also connected the repo to Vercel, Vercel will auto-redeploy with the fresh posts.

When the cookies expire (usually monthly), the scraper run will log "redirected to login" — just re-export cookies and update the secret.

---

### Going to production (Phase 3)

Vercel's filesystem is read-only at runtime, so once deployed:

- **Reads work fine** — `data/*.json` is bundled at build time; the UI shows the posts that existed at last deploy. Every cron commit triggers a fresh deploy, so this lags ~1 build.
- **Writes don't work** — editing groups/keywords in the live UI won't persist (API routes will error on `fs.writeFile`).

If you only need the live site to *read* posts and you're OK editing groups locally, the current setup deploys to Vercel as-is. If you want the live site to also edit groups/profile, swap `lib/store.ts` for a Postgres-backed implementation:

1. Sign up at [neon.tech](https://neon.tech) (free tier), create a project, copy the connection string.
2. `npm i @neondatabase/serverless` and add a `lib/store-pg.ts` with the same exported function shapes.
3. Set `DATABASE_URL` in Vercel + as a GitHub Actions secret.
4. Re-export `lib/store.ts` from the PG version.

The function signatures in `lib/store.ts` were designed to make this swap mechanical.

---

### File layout

```
app/
  page.tsx              # main UI
  layout.tsx, globals.css
  api/
    groups/route.ts     # GET / POST / DELETE
    posts/route.ts      # GET (with filter query params)
    profile/route.ts    # GET / PUT
components/
  MultiSelect.tsx       # chips-style multi-select w/ suggestions + custom values
  GroupManager.tsx      # add / remove / toggle FB groups
  PostCard.tsx          # single matched-post card
lib/
  types.ts              # FbGroup, Post, SearchProfile, MatchedPost
  seed.ts               # seed data + suggested locations/keywords
  filter.ts             # location/keyword matching
  store.ts              # JSON-file persistence (swap for Postgres in Phase 3)
  api.ts                # browser-side API client
scripts/
  scrape.ts             # Playwright scraper (FB groups → data/posts.json)
.github/workflows/
  scrape.yml            # cron job: runs scraper every 5h, commits posts back
data/                   # JSON store (created on first run)
```

### Caveats

- **FB account risk** — scraping a logged-in account violates FB ToS. Use a secondary/throwaway account. The scraper is read-only (no posting).
- **Selectors break** — FB changes their HTML occasionally. If the scraper logs `found 0 candidate posts` consistently, the selector in `scripts/scrape.ts` needs updating.
- **Best-effort timestamps** — FB hides exact post times in the DOM (they show "5 hrs" etc.); the scraper records the time it found the post, not the time it was posted. Good enough for "what's new in the last few hours".
