import type { FbGroup, MatchedPost, SearchProfile } from "./types";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function apiGetGroups(): Promise<FbGroup[]> {
  const data = await jsonOrThrow<{ groups: FbGroup[] }>(await fetch("/api/groups"));
  return data.groups;
}

export async function apiAddGroup(input: { name: string; url: string }): Promise<FbGroup> {
  const data = await jsonOrThrow<{ group: FbGroup }>(
    await fetch("/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return data.group;
}

export async function apiRemoveGroup(id: string): Promise<void> {
  await jsonOrThrow<{ ok: true }>(
    await fetch(`/api/groups?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
  );
}

export async function apiGetProfile(): Promise<SearchProfile> {
  const data = await jsonOrThrow<{ profile: SearchProfile }>(await fetch("/api/profile"));
  return data.profile;
}

export async function apiSaveProfile(profile: SearchProfile): Promise<SearchProfile> {
  const data = await jsonOrThrow<{ profile: SearchProfile }>(
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile),
    }),
  );
  return data.profile;
}

export async function apiGetMatchedPosts(profile: SearchProfile): Promise<MatchedPost[]> {
  const q = new URLSearchParams({
    locations: profile.locations.join(","),
    keywords: profile.keywords.join(","),
    groupIds: profile.groupIds.join(","),
  });
  const data = await jsonOrThrow<{ posts: MatchedPost[] }>(
    await fetch(`/api/posts?${q.toString()}`),
  );
  return data.posts;
}
