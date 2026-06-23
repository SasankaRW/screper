/**
 * Store selector.
 *
 * - If DATABASE_URL is set → Neon Postgres backend (production / shared state).
 * - Otherwise → JSON-file backend (local dev, zero setup).
 *
 * Both implementations expose the same function shapes (see lib/types.ts), so
 * the rest of the app and the scraper consume them identically.
 */
import * as json from "./store-json";
import * as pg from "./store-pg";

const USE_PG = !!process.env.DATABASE_URL;
const impl = USE_PG ? pg : json;

export const getGroups = impl.getGroups;
export const addGroup = impl.addGroup;
export const removeGroup = impl.removeGroup;
export const getPosts = impl.getPosts;
export const upsertPosts = impl.upsertPosts;
export const getProfile = impl.getProfile;
export const saveProfile = impl.saveProfile;

export const backend: "postgres" | "json" = USE_PG ? "postgres" : "json";
