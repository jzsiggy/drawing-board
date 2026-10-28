"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/draw", label: "Draw", icon: <path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" /> },
  { href: "/gallery", label: "Gallery", icon: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /> },
  {
    href: "/who",
    label: "People",
    icon: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 3a4 4 0 0 1 0 8M18 15c2.5.5 4 2.5 4 6" />,
  },
];

// Draw · Gallery · People, along the bottom of the main tabs.
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex h-16 shrink-0 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const current = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs no-underline ${
              current ? "font-medium text-primary shadow-[inset_0_2px_0_var(--primary)]" : "text-muted"
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" aria-hidden>
              {tab.icon}
            </svg>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
