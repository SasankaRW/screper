"use client";

import { useEffect, useRef, useState } from "react";
import { MultiSelect } from "@/components/MultiSelect";
import { GroupManager } from "@/components/GroupManager";
import { PostCard } from "@/components/PostCard";
import { SUGGESTED_KEYWORDS, SUGGESTED_LOCATIONS } from "@/lib/seed";
import {
  apiAddGroup,
  apiGetGroups,
  apiGetMatchedPosts,
  apiGetProfile,
  apiRemoveGroup,
  apiSaveProfile,
} from "@/lib/api";
import type { FbGroup, MatchedPost, SearchProfile } from "@/lib/types";

const EMPTY_PROFILE: SearchProfile = { locations: [], keywords: [], groupIds: [] };

export default function HomePage() {
  const [groups, setGroups] = useState<FbGroup[]>([]);
  const [profile, setProfile] = useState<SearchProfile>(EMPTY_PROFILE);
  const [matches, setMatches] = useState<MatchedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [g, p] = await Promise.all([apiGetGroups(), apiGetProfile()]);
        setGroups(g);
        setProfile(p);
        setMatches(await apiGetMatchedPosts(p));
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
        initialized.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    const t = setTimeout(async () => {
      try {
        await apiSaveProfile(profile);
        setMatches(await apiGetMatchedPosts(profile));
      } catch (e: any) {
        setError(e.message || "Failed to refresh");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [profile]);

  async function handleAddGroup(input: { name: string; url: string }) {
    try {
      const g = await apiAddGroup(input);
      setGroups((prev) => [...prev, g]);
      setProfile((p) => ({ ...p, groupIds: [...p.groupIds, g.id] }));
    } catch (e: any) {
      setError(e.message || "Failed to add group");
    }
  }

  async function handleRemoveGroup(id: string) {
    try {
      await apiRemoveGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setProfile((p) => ({ ...p, groupIds: p.groupIds.filter((x) => x !== id) }));
    } catch (e: any) {
      setError(e.message || "Failed to remove group");
    }
  }

  function toggleGroup(id: string) {
    setProfile((p) => ({
      ...p,
      groupIds: p.groupIds.includes(id)
        ? p.groupIds.filter((x) => x !== id)
        : [...p.groupIds, id],
    }));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">FB Rental Finder</h1>
        <p className="text-sm text-neutral-500">
          Phase 2 · settings persist via JSON store · scraper runs separately (see README)
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-200">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-xs underline"
          >
            dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
          <div className="space-y-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <MultiSelect
              label="Locations"
              placeholder="e.g. Malabe, Kaduwela"
              suggestions={SUGGESTED_LOCATIONS}
              selected={profile.locations}
              onChange={(locations) => setProfile((p) => ({ ...p, locations }))}
            />
            <MultiSelect
              label="Keywords"
              placeholder="e.g. annex, 2 rooms, kitchen"
              suggestions={SUGGESTED_KEYWORDS}
              selected={profile.keywords}
              onChange={(keywords) => setProfile((p) => ({ ...p, keywords }))}
            />
            <hr className="border-neutral-200 dark:border-neutral-800" />
            <GroupManager
              groups={groups}
              selectedIds={profile.groupIds}
              onToggle={toggleGroup}
              onAdd={handleAddGroup}
              onRemove={handleRemoveGroup}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">
                {matches.length} matching post{matches.length === 1 ? "" : "s"}
              </h2>
              <span className="text-xs text-neutral-500">Newest first</span>
            </div>
            {matches.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center text-sm text-neutral-500">
                No posts match your filters. Try removing a location or keyword.
              </div>
            ) : (
              <ul className="space-y-3">
                {matches.map((p) => (
                  <li key={p.id}>
                    <PostCard post={p} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
