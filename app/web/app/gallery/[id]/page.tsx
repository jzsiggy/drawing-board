/* eslint-disable @next/next/no-img-element -- images come from /api/images redirects */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { FramePanel } from "@/components/FramePanel";
import { LocalDate } from "@/components/LocalDate";
import { VersionActions } from "@/components/VersionActions";
import { VersionRow } from "@/components/VersionRow";
import { getGalleryDrawing, type GalleryVersion } from "@/lib/gallery";

export const metadata: Metadata = { title: "Drawing · Sketch to poster" };

export default function DrawingPage({ params, searchParams }: PageProps<"/gallery/[id]">) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-6 pb-16">
      <Suspense fallback={<div className="aspect-[3/4] w-3/5 animate-pulse rounded-md bg-line/60" aria-hidden />}>
        <Drawing params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Drawing({
  params,
  searchParams,
}: {
  params: PageProps<"/gallery/[id]">["params"];
  searchParams: PageProps<"/gallery/[id]">["searchParams"];
}) {
  await connection();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const drawing = await getGalleryDrawing(id.data);
  if (!drawing) notFound();

  // ?v=<version> picks one; otherwise the newest finished poster.
  const { v } = await searchParams;
  const finished = drawing.versions.filter((x) => x.status === "succeeded");
  const selected =
    drawing.versions.find((x) => x.id === v) ?? finished[finished.length - 1] ?? drawing.versions[drawing.versions.length - 1];
  const number = (version: GalleryVersion) => drawing.versions.indexOf(version) + 1;

  return (
    <>
      <header className="flex items-baseline justify-between gap-4 text-sm">
        <Link href="/gallery" className="font-mono text-xs tracking-widest text-muted uppercase hover:text-ink">
          ← Gallery
        </Link>
        <span className="truncate text-muted">
          {drawing.artistName} · <LocalDate iso={drawing.createdAt} />
        </span>
      </header>

      {/* The drawing, then its versions, side by side; swipe to see more. */}
      <VersionRow selectedId={selected?.id ?? null}>
        <figure className="flex w-[58%] shrink-0 snap-start flex-col gap-2 sm:w-[30%]">
          <img
            src={`/api/images/sketch/${drawing.id}`}
            alt={`Drawing by ${drawing.artistName}`}
            className="aspect-[3/4] w-full rounded-md bg-white object-cover shadow-[0_1px_3px_rgb(0_0_0/0.12)]"
          />
          <figcaption className="font-mono text-xs tracking-wider text-muted uppercase">Drawing</figcaption>
        </figure>
        {drawing.versions.map((version) => (
          <Link
            key={version.id}
            href={`/gallery/${drawing.id}?v=${version.id}`}
            replace
            scroll={false}
            aria-current={version === selected ? "true" : undefined}
            className="flex w-[58%] shrink-0 snap-start flex-col gap-2 sm:w-[30%]"
          >
            <VersionImage version={version} number={number(version)} selected={version === selected} />
            <span className="flex flex-col font-mono text-xs tracking-wider uppercase">
              <span className={version === selected ? "" : "text-muted"}>Version {number(version)}</span>
              {version.onFrame ? (
                <span className="text-accent">On the frame</span>
              ) : version.beenOnFrame ? (
                <span className="text-muted">Was on the frame</span>
              ) : null}
            </span>
          </Link>
        ))}
      </VersionRow>

      {selected && (
        <section className="flex flex-col gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Version {number(selected)}
            {drawing.versions.length > 1 && <span className="text-muted"> of {drawing.versions.length}</span>}
          </h1>
          {selected.status === "succeeded" && <FramePanel key={selected.id} generationId={selected.id} />}
          {(selected.status === "pending" || selected.status === "running") && (
            <p className="text-muted">
              Still printing.{" "}
              <Link href={`/result/${selected.id}`} className="text-ink underline">
                Watch it finish
              </Link>
            </p>
          )}
        </section>
      )}

      <VersionActions drawingId={drawing.id} />
    </>
  );
}

function VersionImage({ version, number, selected }: { version: GalleryVersion; number: number; selected: boolean }) {
  const frame = `aspect-[3/4] w-full rounded-md transition ${selected ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : ""}`;
  if (version.status !== "succeeded") {
    return (
      <div className={`${frame} flex items-center justify-center bg-card text-sm text-muted`}>Printing…</div>
    );
  }
  return (
    <img
      src={`/api/images/poster/${version.id}`}
      alt={`Poster version ${number}`}
      loading="lazy"
      className={`${frame} bg-card object-cover shadow-[0_1px_3px_rgb(0_0_0/0.12)]`}
    />
  );
}
