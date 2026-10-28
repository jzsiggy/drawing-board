import Link from "next/link";

import { DisplayStatus } from "./DisplayStatus";

// The top bar on the main tabs: the app's name, and whether the display is online.
export function AppHeader({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <header
      className={`flex h-14 shrink-0 items-center justify-between border-b px-5 ${
        tone === "dark" ? "border-white/20 text-white" : "border-line"
      }`}
    >
      <Link href="/draw" className="microcaps no-underline">
        Sketch to poster
      </Link>
      <DisplayStatus tone={tone} />
    </header>
  );
}

// The top bar inside a flow: a way back on the left, where you are on the right.
export function BackHeader({ href, back, label }: { href: string; back: string; label?: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line pr-5 pl-2">
      <Link href={href} className="flex min-h-11 items-center gap-1 px-2 text-sm text-ink no-underline">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
        {back}
      </Link>
      {label && <span className="microcaps">{label}</span>}
    </header>
  );
}
