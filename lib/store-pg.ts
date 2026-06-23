import { neon } from "@neondatabase/serverless";
import type { FbGroup, Post, SearchProfile } from "./types";

let _sql: ReturnType<typeof neon> | null = null;
let _schemaReady: Promise<void> | null = null;

function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string to your env.",
    );
  }
  _sql = neon(url);
  return _sql;
}

async function ensureSchema(): Promise<void> {
  if (_schemaReady) return _schemaReady;
  const sql = getSql();
  _schemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        group_name TEXT NOT NULL,
        author TEXT NOT NULL,
        body TEXT NOT NULL,
        permalink TEXT NOT NULL,
        posted_at TIMESTAMPTZ NOT NULL,
        price_lkr INTEGER
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS posts_posted_at_idx ON posts (posted_at DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY,
        locations TEXT[] NOT NULL DEFAULT '{}',
        keywords TEXT[] NOT NULL DEFAULT '{}',
        group_ids TEXT[] NOT NULL DEFAULT '{}'
      )
    `;
    await sql`
      INSERT INTO profile (id, locations, keywords, group_ids)
      VALUES (1, '{}', '{}', '{}')
      ON CONFLICT (id) DO NOTHING
    `;
  })();
  return _schemaReady;
}

type GroupRow = { id: string; name: string; url: string; added_at: string };
type PostRow = {
  id: string;
  group_id: string;
  group_name: string;
  author: string;
  body: string;
  permalink: string;
  posted_at: string;
  price_lkr: number | null;
};
type ProfileRow = {
  locations: string[];
  keywords: string[];
  group_ids: string[];
};

function rowToGroup(r: GroupRow): FbGroup {
  return { id: r.id, name: r.name, url: r.url, addedAt: new Date(r.added_at).toISOString() };
}

function rowToPost(r: PostRow): Post {
  return {
    id: r.id,
    groupId: r.group_id,
    groupName: r.group_name,
    author: r.author,
    text: r.body,
    permalink: r.permalink,
    postedAt: new Date(r.posted_at).toISOString(),
    priceLkr: r.price_lkr ?? undefined,
  };
}

export async function getGroups(): Promise<FbGroup[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`SELECT id, name, url, added_at FROM groups ORDER BY added_at ASC`) as GroupRow[];
  return rows.map(rowToGroup);
}

export async function addGroup(input: { name: string; url: string }): Promise<FbGroup> {
  await ensureSchema();
  const sql = getSql();
  const id = `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const addedAt = new Date();
  await sql`
    INSERT INTO groups (id, name, url, added_at)
    VALUES (${id}, ${input.name}, ${input.url}, ${addedAt})
  `;
  return { id, name: input.name, url: input.url, addedAt: addedAt.toISOString() };
}

export async function removeGroup(id: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM groups WHERE id = ${id}`;
}

export async function getPosts(): Promise<Post[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, group_id, group_name, author, body, permalink, posted_at, price_lkr
    FROM posts
    ORDER BY posted_at DESC
  `) as PostRow[];
  return rows.map(rowToPost);
}

export async function upsertPosts(
  incoming: Post[],
): Promise<{ added: number; total: number }> {
  await ensureSchema();
  const sql = getSql();
  if (incoming.length === 0) {
    const totalRows = (await sql`SELECT COUNT(*)::int AS c FROM posts`) as Array<{ c: number }>;
    return { added: 0, total: totalRows[0]?.c ?? 0 };
  }
  // xmax=0 in RETURNING means the row was newly inserted (not updated by ON CONFLICT).
  // Run each upsert via sql.transaction so they batch into one HTTP round-trip.
  const queries = incoming.map(
    (p) => sql`
      INSERT INTO posts (id, group_id, group_name, author, body, permalink, posted_at, price_lkr)
      VALUES (${p.id}, ${p.groupId}, ${p.groupName}, ${p.author}, ${p.text}, ${p.permalink}, ${new Date(p.postedAt)}, ${p.priceLkr ?? null})
      ON CONFLICT (id) DO UPDATE SET
        group_name = EXCLUDED.group_name,
        author = EXCLUDED.author,
        body = EXCLUDED.body,
        permalink = EXCLUDED.permalink,
        price_lkr = EXCLUDED.price_lkr
      RETURNING (xmax = 0) AS inserted
    `,
  );
  const results = (await sql.transaction(queries)) as Array<Array<{ inserted: boolean }>>;
  const added = results.reduce((sum, rows) => sum + (rows[0]?.inserted ? 1 : 0), 0);
  const totalRows = (await sql`SELECT COUNT(*)::int AS c FROM posts`) as Array<{ c: number }>;
  return { added, total: totalRows[0]?.c ?? 0 };
}

export async function getProfile(): Promise<SearchProfile> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT locations, keywords, group_ids FROM profile WHERE id = 1
  `) as ProfileRow[];
  const r = rows[0] ?? { locations: [], keywords: [], group_ids: [] };
  return { locations: r.locations, keywords: r.keywords, groupIds: r.group_ids };
}

export async function saveProfile(profile: SearchProfile): Promise<SearchProfile> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO profile (id, locations, keywords, group_ids)
    VALUES (1, ${profile.locations}, ${profile.keywords}, ${profile.groupIds})
    ON CONFLICT (id) DO UPDATE SET
      locations = EXCLUDED.locations,
      keywords = EXCLUDED.keywords,
      group_ids = EXCLUDED.group_ids
  `;
  return profile;
}
