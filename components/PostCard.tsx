import type { MatchedPost } from "@/lib/types";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fmtPrice(n?: number) {
  if (!n) return null;
  return `LKR ${n.toLocaleString()}`;
}

export function PostCard({ post }: { post: MatchedPost }) {
  const price = fmtPrice(post.priceLkr);
  return (
    <article className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{post.author}</span>
        <span className="text-xs text-neutral-500">in {post.groupName}</span>
        <span className="text-xs text-neutral-500 ml-auto">{fmtDate(post.postedAt)}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap">{post.text}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {post.matchedLocations.map((l) => (
          <span
            key={`loc-${l}`}
            className="rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-100 px-2 py-0.5 text-xs"
          >
            {l}
          </span>
        ))}
        {post.matchedKeywords.map((k) => (
          <span
            key={`kw-${k}`}
            className="rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100 px-2 py-0.5 text-xs"
          >
            {k}
          </span>
        ))}
        {price && (
          <span className="ml-auto text-sm font-semibold">{price}</span>
        )}
      </div>
      <div>
        <a
          href={post.permalink}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          View on Facebook →
        </a>
      </div>
    </article>
  );
}
