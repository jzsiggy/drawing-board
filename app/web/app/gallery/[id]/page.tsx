/* eslint-disable @next/next/no-img-element -- images come from /api/images redirects */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { BackHeader } from "@/components/AppHeader";
import { LocalDate, LocalTime } from "@/components/LocalDate";
import { VersionRow } from "@/components/VersionRow";
import { featuredPosterOfDrawing, getPoster } from "@/lib/gallery";
import { createAdminClient } from "@/lib/supabase/admin";
import { PosterActions } from "./PosterActions";

export const metadata: Metadata = { title: "Poster · Sketch to poster" };

export default function PosterPage({ params }: PageProps<"/gallery/[id]">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <BackHeader href="/gallery" back="Gallery" />
      <Suspense fallback={<div className="mx-auto mt-6 aspect-[3/4] w-60 animate-pulse bg-sunken" aria-hidden />}>
        <Poster params={params} />
      </Suspense>
    </div>
  );
}

async function Poster({ params }: { params: PageProps<"/gallery/[id]">["params"] }) {
  await connection();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const poster = await getPoster(id.data);
  if (!poster) {
    // A poster still being made has its own page; an old link may name a drawing.
    const { data } = await createAdminClient().from("generations").select("status").eq("id", id.data).maybeSingle();
    if (data && (data.status === "pending" || data.status === "running")) redirect(`/result/${id.data}`);
    const featured = data ? null : await featuredPosterOfDrawing(id.data);
    if (featured) redirect(`/gallery/${featured}`);
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-5 pt-6 pb-5">
      <img
        src={`/api/images/poster/${poster.id}`}
        alt={`${poster.title}, by ${poster.artistName}`}
        className="mx-auto aspect-[3/4] w-60 bg-sunken object-cover"
      />

      <div className="flex flex-col gap-1">
        <h1 className="text-4xl leading-[34px]">{poster.title}</h1>
        <p className="text-sm text-muted">by {poster.artistName}</p>
      </div>

      <div className="flex items-stretch gap-3.5">
        <dl className="flex flex-1 flex-col border-t border-line text-sm">
          <Row label="Style">{poster.styleName}</Row>
          <Row label="Made">
            <LocalDate iso={poster.createdAt} long />
          </Row>
          <Row label="Last shown">
            {poster.onFrame ? (
              "On the display now"
            ) : poster.lastShownAt ? (
              <LocalTime iso={poster.lastShownAt} />
            ) : (
              "Not yet"
            )}
          </Row>
        </dl>
        <figure className="flex w-[54px] shrink-0 flex-col gap-1">
          <img
            src={`/api/images/sketch/${poster.drawingId}`}
            alt="The original sketch"
            className="aspect-[3/4] w-full border border-line bg-white object-cover"
          />
          <figcaption className="text-xs text-muted">Sketch</figcaption>
        </figure>
      </div>

      {poster.versions.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="microcaps text-muted">
            Version {poster.versions.find((v) => v.id === poster.id)?.number} of {poster.versions.length}
          </h2>
          <VersionRow selectedId={poster.id}>
            {poster.versions.map((v) => (
              <Link
                key={v.id}
                href={`/gallery/${v.id}`}
                replace
                scroll={false}
                aria-current={v.id === poster.id ? "true" : undefined}
                className="flex w-16 shrink-0 snap-start flex-col gap-1"
              >
                <img
                  src={`/api/images/thumb/${v.id}`}
                  alt={`Version ${v.number}${v.onFrame ? ", on the display now" : ""}`}
                  loading="lazy"
                  className={`aspect-[3/4] w-full bg-sunken object-cover ${v.id === poster.id ? "outline-2 outline-offset-2 outline-ink" : ""}`}
                />
                <span className={`text-xs ${v.onFrame ? "font-medium text-online" : "text-muted"}`}>
                  {v.onFrame ? "On display" : `V${v.number}`}
                </span>
              </Link>
            ))}
          </VersionRow>
        </section>
      )}

      <PosterActions key={poster.id} generationId={poster.id} drawingId={poster.drawingId} />
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 border-b border-line py-2 leading-4">
      <dt className="font-medium">{label}</dt>
      <dd className="text-right text-muted">{children}</dd>
    </div>
  );
}
