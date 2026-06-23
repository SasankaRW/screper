import type { FbGroup, Post } from "./types";

// Initial seeds for the JSON store on first run. Empty by design — the UI starts
// blank and groups are added by the user; posts are populated by the scraper.
export const SEED_GROUPS: FbGroup[] = [];
export const SEED_POSTS: Post[] = [];

// Autocomplete hints for the location / keyword multi-selects. Tailored to the
// initial use case (rentals around Malabe); edit freely.
export const SUGGESTED_LOCATIONS = [
  "Malabe",
  "Kaduwela",
  "Battaramulla",
  "Athurugiriya",
  "Kothalawala",
  "Thalahena",
  "Pelawatte",
  "Rajagiriya",
  "Kotte",
  "Nugegoda",
];

export const SUGGESTED_KEYWORDS = [
  "annex",
  "annexe",
  "house",
  "apartment",
  "2 rooms",
  "two rooms",
  "2 bedroom",
  "kitchen",
  "attached bathroom",
  "parking",
  "furnished",
  "unfurnished",
];
