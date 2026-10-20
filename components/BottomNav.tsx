"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconAdjustments, IconCalendarWeek, IconDownload, IconHistory, IconHome, IconLogout, IconMenu2, IconX } from "@tabler/icons-react";

const LINKS = [
  { href: "/", label: "Heute", Icon: IconHome },
  { href: "/verlauf", label: "Verlauf", Icon: IconHistory },
  { href: "/woche", label: "Woche", Icon: IconCalendarWeek },
] as const;

const item = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-sm font-semibold";

// Heute, Verlauf and Woche, plus a menu with who is signed in, the household's lists, the CSV export and Abmelden.
export function BottomNav({ userName }: { userName: string }) {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav aria-label="Hauptmenü" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      {menuOpen && <Menu userName={userName} onClose={() => setMenuOpen(false)} />}
      <div className="mx-auto flex max-w-xl">
        {LINKS.map(({ href, label, Icon }) => {
          const active = path === href;
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`${item} ${active ? "text-primary" : "text-muted"}`}>
              <Icon size={26} stroke={active ? 2.2 : 1.8} aria-hidden />
              {label}
            </Link>
          );
        })}
        <button type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)} className={`${item} ${menuOpen ? "text-primary" : "text-muted"}`}>
          {menuOpen ? <IconX size={26} aria-hidden /> : <IconMenu2 size={26} aria-hidden />}
          Menü
        </button>
      </div>
    </nav>
  );
}

function Menu({ userName, onClose }: { userName: string; onClose: () => void }) {
  const row = "flex min-h-14 w-full items-center gap-3 px-5 text-lg";
  return (
    <div className="absolute inset-x-0 bottom-full border-t border-line bg-surface shadow-[0_-12px_32px_-16px_rgb(0_0_0/0.35)]">
      <p className="px-5 pt-4 pb-2 text-muted">
        Angemeldet als <strong className="text-ink">{userName}</strong>
      </p>
      <Link href="/einstellungen" className={row} onClick={onClose}>
        <IconAdjustments size={24} aria-hidden /> Übungen und Leckerlis
      </Link>
      <a href="/export.csv" download className={row} onClick={onClose}>
        <IconDownload size={24} aria-hidden /> Als CSV exportieren
      </a>
      <form action="/logout" method="post">
        <button type="submit" className={`${row} text-danger`}>
          <IconLogout size={24} aria-hidden /> Abmelden
        </button>
      </form>
    </div>
  );
}
