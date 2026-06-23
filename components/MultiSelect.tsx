"use client";

import { useMemo, useState } from "react";

type Props = {
  label: string;
  placeholder?: string;
  suggestions: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  allowCustom?: boolean;
};

export function MultiSelect({
  label,
  placeholder,
  suggestions,
  selected,
  onChange,
  allowCustom = true,
}: Props) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = input.toLowerCase().trim();
    const selectedSet = new Set(selected.map((s) => s.toLowerCase()));
    return suggestions
      .filter((s) => !selectedSet.has(s.toLowerCase()))
      .filter((s) => (q ? s.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [input, suggestions, selected]);

  function add(value: string) {
    const v = value.trim();
    if (!v) return;
    if (selected.some((s) => s.toLowerCase() === v.toLowerCase())) return;
    onChange([...selected, v]);
    setInput("");
  }

  function remove(value: string) {
    onChange(selected.filter((s) => s !== value));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[0]) add(filtered[0]);
      else if (allowCustom) add(input);
    } else if (e.key === "Backspace" && !input && selected.length) {
      remove(selected[selected.length - 1]);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      <div className="relative">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 focus-within:ring-2 focus-within:ring-blue-500">
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 px-2 py-0.5 text-xs"
            >
              {s}
              <button
                type="button"
                onClick={() => remove(s)}
                className="text-blue-700 dark:text-blue-200 hover:text-red-600"
                aria-label={`Remove ${s}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            placeholder={selected.length ? "" : placeholder}
            className="flex-1 min-w-[8rem] bg-transparent outline-none text-sm"
          />
        </div>
        {open && filtered.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg">
            {filtered.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => add(s)}
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {allowCustom && (
        <p className="text-xs text-neutral-500">
          Type and press Enter to add custom values.
        </p>
      )}
    </div>
  );
}
