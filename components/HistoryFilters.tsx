import Link from "next/link";
import type { HistoryFilter } from "@/backend";
import { ENTRY_TYPES, TYPE_LABEL } from "@/shared/entryTypes";
import { TYPE_COLOR } from "./entryStyle";

type Person = { username: string; name: string };

const href = (f: HistoryFilter) => {
  const q = new URLSearchParams({ ...(f.type ? { type: f.type } : {}), ...(f.by ? { by: f.by } : {}), ...(f.day ? { day: f.day } : {}) });
  return q.size ? `/verlauf?${q}` : "/verlauf";
};

const dayLabel = (day: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(Date.parse(`${day}T12:00:00Z`));

// Two rows of chips, by type and by person; each is a link, so a filter is a URL that can be bookmarked. A day picked
// on the Woche page shows as one more chip that clears it.
export function HistoryFilters({ filter, people }: { filter: HistoryFilter; people: Person[] }) {
  return (
    <div className="flex flex-col gap-2">
      {filter.day && (
        <div className="flex">
          <Chip href={href({ ...filter, day: undefined })} active>
            Tag: {dayLabel(filter.day)} ✕
          </Chip>
        </div>
      )}
      <ChipRow label="Nach Art">
        <Chip href={href({ ...filter, type: undefined })} active={!filter.type}>
          Alle
        </Chip>
        {ENTRY_TYPES.map((t) => (
          <Chip key={t} href={href({ ...filter, type: t })} active={filter.type === t} color={TYPE_COLOR[t]}>
            {TYPE_LABEL[t]}
          </Chip>
        ))}
      </ChipRow>
      <ChipRow label="Nach Person">
        <Chip href={href({ ...filter, by: undefined })} active={!filter.by}>
          Alle
        </Chip>
        {people.map((p) => (
          <Chip key={p.username} href={href({ ...filter, by: p.username })} active={filter.by === p.username}>
            {p.name}
          </Chip>
        ))}
      </ChipRow>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <nav aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {children}
    </nav>
  );
}

function Chip({ href, active, color = "var(--primary)", children }: { href: string; active: boolean; color?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      aria-current={active ? "true" : undefined}
      style={{ "--c": color } as React.CSSProperties}
      className={`flex min-h-12 shrink-0 items-center rounded-full border-2 px-4 font-semibold ${active ? "border-(--c) bg-(--c) text-surface" : "border-line bg-surface text-ink"}`}
    >
      {children}
    </Link>
  );
}
