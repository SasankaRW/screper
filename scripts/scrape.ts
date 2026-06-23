/**
 * FB group post scraper.
 *
 * - Loads cookies from FB_COOKIES (JSON array, in Playwright cookie format)
 * - For each saved group, opens the group page and extracts visible posts
 * - Writes new/updated posts to the JSON store via lib/store
 *
 * Run locally:   npm run scrape
 * Prereq once:   npm run scrape:install-browser
 *
 * Cookies: log into Facebook in a browser, export cookies as JSON
 * (e.g. with the "Cookie-Editor" extension → "Export → JSON"), then:
 *   - For local runs: put the JSON into a `.env.local` line:
 *       FB_COOKIES='[ ... ]'
 *     and run `npm run scrape`
 *   - For GitHub Actions: paste the JSON into a repo secret named FB_COOKIES.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Cookie } from "playwright";
import { getGroups, upsertPosts } from "../lib/store";
import type { Post } from "../lib/types";

const MAX_SCROLLS = 6;
const SCROLL_DELAY_MS = 2000;
const PRICE_RE = /(?:rs|lkr|rs\.|lkr\.)\s*([\d,]{3,})|(\d{2,3}[,\.]?\d{3})\s*\/?=?/i;

function normalizeSameSite(v: unknown): "Strict" | "Lax" | "None" {
  if (typeof v !== "string") return "Lax";
  const s = v.toLowerCase();
  if (s === "strict") return "Strict";
  if (s === "none" || s === "no_restriction") return "None";
  // "lax", "unspecified", "", or anything unexpected → safe default
  return "Lax";
}

async function loadCookies(): Promise<Cookie[]> {
  // Prefer env var (works for GH Actions); fall back to .env.local for dev convenience.
  let raw = process.env.FB_COOKIES;
  if (!raw) {
    try {
      const envFile = await fs.readFile(
        path.join(process.cwd(), ".env.local"),
        "utf-8",
      );
      const match = envFile.match(/^FB_COOKIES\s*=\s*['"]?(.+?)['"]?\s*$/m);
      if (match) raw = match[1];
    } catch {}
  }
  if (!raw) {
    throw new Error(
      "FB_COOKIES is not set. Export your Facebook cookies (JSON) and set FB_COOKIES.",
    );
  }
  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
  // Normalize to Playwright Cookie shape. Common exports use 'expirationDate' (sec) instead of 'expires'.
  return parsed.map((c) => {
    const out: Cookie = {
      name: String(c.name),
      value: String(c.value),
      domain: String(c.domain ?? ".facebook.com"),
      path: String(c.path ?? "/"),
      httpOnly: Boolean(c.httpOnly),
      secure: c.secure !== false,
      sameSite: normalizeSameSite(c.sameSite),
      expires:
        typeof c.expires === "number"
          ? c.expires
          : typeof c.expirationDate === "number"
            ? Math.floor(c.expirationDate)
            : -1,
    };
    return out;
  });
}

function extractPrice(text: string): number | undefined {
  const m = text.match(PRICE_RE);
  if (!m) return undefined;
  const raw = (m[1] || m[2] || "").replace(/[^\d]/g, "");
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1000 || n > 10_000_000) return undefined;
  return n;
}

async function scrapeGroup(
  ctx: BrowserContext,
  group: { id: string; name: string; url: string },
): Promise<Post[]> {
  const page = await ctx.newPage();
  console.log(`→ ${group.name} (${group.url})`);
  await page.goto(group.url, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // Bail early if FB redirected us to login.
  if (page.url().includes("/login")) {
    console.warn(`  ! redirected to login — cookies may be expired`);
    await page.close();
    return [];
  }

  for (let i = 0; i < MAX_SCROLLS; i++) {
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(SCROLL_DELAY_MS);
  }

  // FB renders posts inside <div role="article">. Each post has at least one anchor
  // whose href contains "/posts/" or "/permalink/" — we use that as the permalink + id.
  const rows = await page
    .locator('div[role="article"]')
    .evaluateAll((articles) => {
      const seen = new Set<string>();
      const out: Array<{ text: string; permalink: string; author: string | null }> = [];
      for (const a of articles) {
        const text = (a as HTMLElement).innerText?.trim() ?? "";
        if (!text || text.length < 40) continue;
        const link = (a as HTMLElement).querySelector<HTMLAnchorElement>(
          'a[href*="/posts/"], a[href*="/permalink/"], a[href*="/groups/"][href*="/posts/"]',
        );
        if (!link?.href) continue;
        const permalink = link.href.split("?")[0];
        if (seen.has(permalink)) continue;
        seen.add(permalink);
        const authorEl = (a as HTMLElement).querySelector<HTMLElement>(
          'h3 a, h2 a, strong a, [aria-label] strong',
        );
        out.push({ text, permalink, author: authorEl?.innerText?.trim() || null });
      }
      return out;
    });

  await page.close();
  console.log(`  found ${rows.length} candidate posts`);

  const nowIso = new Date().toISOString();
  const posts: Post[] = rows.map((r) => {
    const idMatch = r.permalink.match(/(?:posts|permalink)\/([^/?#]+)/);
    const id = `fb_${group.id}_${idMatch?.[1] ?? Buffer.from(r.permalink).toString("base64url").slice(0, 24)}`;
    return {
      id,
      groupId: group.id,
      groupName: group.name,
      author: r.author || "Unknown",
      text: r.text,
      permalink: r.permalink,
      postedAt: nowIso, // FB hides exact timestamps in DOM; we record scrape time as best-effort
      priceLkr: extractPrice(r.text),
    };
  });

  return posts;
}

async function main() {
  const cookies = await loadCookies();
  const groups = await getGroups();
  if (groups.length === 0) {
    console.log("No groups configured. Add some in the UI first.");
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  await ctx.addCookies(cookies);

  let totalAdded = 0;
  for (const g of groups) {
    try {
      const posts = await scrapeGroup(ctx, g);
      if (posts.length === 0) continue;
      const { added, total } = await upsertPosts(posts);
      console.log(`  + ${added} new (store has ${total} total)`);
      totalAdded += added;
    } catch (err) {
      console.error(`  ! error scraping ${g.name}:`, err);
    }
  }

  await ctx.close();
  await browser.close();
  console.log(`\nDone. Added ${totalAdded} new posts across ${groups.length} groups.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
