import type { Post, MatchedPost, SearchProfile } from "./types";

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function findMatches(haystack: string, needles: string[]): string[] {
  const normHaystack = normalizeForMatch(haystack);
  const found = new Set<string>();
  for (const n of needles) {
    const normNeedle = normalizeForMatch(n);
    if (!normNeedle) continue;
    if (normHaystack.includes(normNeedle)) found.add(n);
  }
  return [...found];
}

export function filterPosts(posts: Post[], profile: SearchProfile): MatchedPost[] {
  const groupFilter = new Set(profile.groupIds);
  const hasGroupFilter = groupFilter.size > 0;
  const hasLocations = profile.locations.length > 0;
  const hasKeywords = profile.keywords.length > 0;

  const matched: MatchedPost[] = [];
  for (const post of posts) {
    if (hasGroupFilter && !groupFilter.has(post.groupId)) continue;

    const matchedLocations = hasLocations ? findMatches(post.text, profile.locations) : [];
    const matchedKeywords = hasKeywords ? findMatches(post.text, profile.keywords) : [];

    if (hasLocations && matchedLocations.length === 0) continue;
    if (hasKeywords && matchedKeywords.length === 0) continue;

    matched.push({ ...post, matchedLocations, matchedKeywords });
  }

  matched.sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
  return matched;
}
