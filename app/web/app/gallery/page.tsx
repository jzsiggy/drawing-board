/* eslint-disable @next/next/no-img-element -- images come from /api/images redirects */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { LocalDate, LocalTime } from "@/components/LocalDate";
import { TabPage } from "@/components/TabPage";
import { listGallery, parseFilter, type GalleryFilter, type PosterCard } from "@/lib/gallery";
import { getCurrentPerson } from "@/lib/session";

export const metadata: Metadata = { title: "Gallery · Sketch to poster" };

const FILTERS: { value: GalleryFilter; label: string; href: string }[] = [
  { value: "all", label: "All", href: "/gallery" },
  { value: "shown", label: "Shown on display", href: "/gallery?filter=shown" },
  { value: "mine", label: "Mine", href: "/gallery?filter=mine" },
];

export default function GalleryPage({ searchParams }: PageProps<"/gallery">) {
  return (
    <TabPage className="gap-5 pt-8 pb-8">
      <Suspense fallback={<GallerySkeleton />}>
        <Gallery searchParams={searchParams} />
      </Suspense>
    </TabPage>
  );
}

async function Gallery({ searchParams }: { searchParams: PageProps<"/gallery">["searchParams"] }) {
  await connection();
  const filter = parseFilter((await searchParams).filter);
  const person = await getCurrentPerson();
  const { onDisplay, cards, posterCount } = await listGallery(filter, person?.id ?? null);

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h1 className="text-[44px] leading-[42px]">Gallery</h1>
        <span className="text-sm text-muted">{posterCount === 1 ? "1 poster" : `${posterCount} posters`}</span>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Show">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.href}
            replace
            scroll={false}
            aria-current={f.value === filter ? "page" : undefined}
            className={`flex h-11 items-center border px-3.5 text-sm ${
              f.value === filter ? "border-ink bg-ink text-white" : "border-line bg-card text-ink"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {onDisplay && <OnDisplayCard card={onDisplay} />}

      {!onDisplay && cards.length === 0 ? (
        <Empty filter={filter} hasPerson={Boolean(person)} />
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.id} card={card} />
          ))}
        </div>
      )}
    </>
  );
}

function OnDisplayCard({ card }: { card: PosterCard }) {
  return (
    <Link href={`/gallery/${card.id}`} className="flex gap-3.5 bg-card p-3 text-ink">
      <img src={`/api/images/thumb/${card.id}`} alt={`${card.title}, on the display now`} className="h-24 w-18 shrink-0 bg-sunken object-cover" />
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <span className="flex h-[22px] items-center gap-1.5 self-start bg-online px-2.5 text-[11px] font-medium tracking-[0.06em] text-white uppercase">
          <span className="block size-1.5 bg-white" aria-hidden />
          On display now
        </span>
        <span className="truncate text-lg leading-[21px]">{card.title}</span>
        <span className="truncate text-sm leading-4 text-muted">
          {card.artistName}
          {card.shownSince && (
            <>
              {" · since "}
              <LocalTime iso={card.shownSince} />
            </>
          )}
        </span>
      </span>
    </Link>
  );
}

function Card({ card }: { card: PosterCard }) {
  return (
    <Link href={`/gallery/${card.id}`} className="flex min-w-0 flex-col gap-2 text-ink">
      <span className="relative block aspect-[3/4] bg-sunken">
        <img src={`/api/images/thumb/${card.id}`} alt={card.title} loading="lazy" className="size-full object-cover" />
        {card.versions > 1 && (
          <span className="absolute top-1.5 right-1.5 bg-ink/85 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {card.versions} versions
          </span>
        )}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="truncate text-sm leading-4 font-medium">{card.title}</span>
        <span className="truncate text-xs leading-[14px] text-muted">
          {card.artistName} · <LocalDate iso={card.createdAt} />
        </span>
      </span>
    </Link>
  );
}

function Empty({ filter, hasPerson }: { filter: GalleryFilter; hasPerson: boolean }) {
  if (filter === "mine" && !hasPerson) {
    return (
      <p className="text-sm text-muted">
        <Link href="/who" className="text-primary underline">
          Pick who you are
        </Link>{" "}
        to see your posters.
      </p>
    );
  }
  const text = {
    all: "No posters yet.",
    mine: "You haven't made a poster yet.",
    shown: "Nothing has been on the display yet.",
  }[filter];
  return (
    <p className="text-sm text-muted">
      {text}{" "}
      <Link href="/draw" className="text-primary underline">
        Draw something
      </Link>
    </p>
  );
}

function GallerySkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-hidden>
      <div className="h-[42px] w-40 bg-sunken" />
      <div className="h-11 w-72 bg-sunken" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-[3/4] bg-sunken" />
        ))}
      </div>
    </div>
  );
}
