/* eslint-disable @next/next/no-img-element -- images come from /api/images redirects */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { LocalDate } from "@/components/LocalDate";
import { listGallery, parseFilter, type GalleryDrawing, type GalleryFilter } from "@/lib/gallery";
import { getCurrentPerson } from "@/lib/session";

export const metadata: Metadata = { title: "Gallery · Sketch to poster" };

const FILTERS: { value: GalleryFilter; label: string; href: string }[] = [
  { value: "all", label: "Everyone", href: "/gallery" },
  { value: "mine", label: "Mine", href: "/gallery?filter=mine" },
  { value: "frame", label: "Been on the frame", href: "/gallery?filter=frame" },
];
const THUMBS_SHOWN = 4;

export default function GalleryPage({ searchParams }: PageProps<"/gallery">) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-8 pb-16">
      <header className="flex items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-bold tracking-tight">Gallery</h1>
        <Link href="/draw" className="pb-1 font-mono text-xs tracking-widest text-muted uppercase hover:text-ink">
          Draw →
        </Link>
      </header>
      <Suspense fallback={<GallerySkeleton />}>
        <Gallery searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Gallery({ searchParams }: { searchParams: PageProps<"/gallery">["searchParams"] }) {
  await connection();
  const filter = parseFilter((await searchParams).filter);
  const person = await getCurrentPerson();
  const drawings = await listGallery(filter, person?.id ?? null);

  return (
    <>
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Show">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.href}
            replace
            scroll={false}
            aria-current={f.value === filter ? "page" : undefined}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${
              f.value === filter ? "border-ink bg-ink text-card" : "border-line hover:border-ink"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {drawings.length === 0 ? (
        <Empty filter={filter} hasPerson={Boolean(person)} />
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
          {drawings.map((drawing) => (
            <DrawingCard key={drawing.id} drawing={drawing} />
          ))}
        </div>
      )}
    </>
  );
}

function DrawingCard({ drawing }: { drawing: GalleryDrawing }) {
  const posters = drawing.versions.filter((v) => v.status === "succeeded");
  const onFrame = posters.some((v) => v.onFrame);
  const more = posters.length - THUMBS_SHOWN;

  return (
    <Link href={`/gallery/${drawing.id}`} className="group flex min-w-0 flex-col gap-2">
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-white shadow-[0_1px_3px_rgb(0_0_0/0.12)] transition group-hover:shadow-[0_2px_10px_rgb(0_0_0/0.16)]">
        <img
          src={`/api/images/sketch/${drawing.id}`}
          alt={`Drawing by ${drawing.artistName}`}
          loading="lazy"
          className="size-full object-cover"
        />
        {onFrame && (
          <span className="absolute top-2 left-2 rounded-full bg-ink/85 px-2 py-0.5 font-mono text-[10px] tracking-widest text-card uppercase">
            On the frame
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate font-mono tracking-wider uppercase">{drawing.artistName}</span>
        <span className="shrink-0 text-muted">
          <LocalDate iso={drawing.createdAt} />
        </span>
      </div>
      {posters.length > 0 && (
        <div className="flex items-center gap-1.5">
          {posters.slice(0, THUMBS_SHOWN).map((v, i) => (
            <img
              key={v.id}
              src={`/api/images/thumb/${v.id}`}
              alt={`Poster version ${i + 1}${v.onFrame ? ", on the frame now" : v.beenOnFrame ? ", has been on the frame" : ""}`}
              loading="lazy"
              className={`aspect-[3/4] h-12 rounded-sm bg-card object-cover opacity-90 ${
                v.onFrame ? "ring-2 ring-accent" : v.beenOnFrame ? "ring-1 ring-ink" : ""
              }`}
            />
          ))}
          {more > 0 && <span className="text-xs text-muted">+{more}</span>}
        </div>
      )}
    </Link>
  );
}

function Empty({ filter, hasPerson }: { filter: GalleryFilter; hasPerson: boolean }) {
  if (filter === "mine" && !hasPerson) {
    return (
      <p className="text-muted">
        <Link href="/who" className="text-ink underline">
          Pick who you are
        </Link>{" "}
        to see your drawings.
      </p>
    );
  }
  const text = {
    all: "No drawings yet.",
    mine: "You haven't drawn anything yet.",
    frame: "Nothing has been on the frame yet.",
  }[filter];
  return (
    <p className="text-muted">
      {text}{" "}
      <Link href="/draw" className="text-ink underline">
        Draw something
      </Link>
    </p>
  );
}

function GallerySkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden>
      <div className="h-9 w-72 rounded-full bg-line/60" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-[3/4] rounded-md bg-line/60" />
        ))}
      </div>
    </div>
  );
}
