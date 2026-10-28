import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getDeviceId } from "@/lib/session";
import type { StrokeDoc } from "@/lib/strokes";
import { createAdminClient } from "@/lib/supabase/admin";
import { PersonForm } from "../../PersonForm";

export const metadata: Metadata = { title: "Edit · Sketch to poster" };

export default function EditPersonPage({ params }: PageProps<"/who/[id]/edit">) {
  return (
    <Suspense>
      <EditPerson params={params} />
    </Suspense>
  );
}

// Only the phone that added a person can edit them.
async function EditPerson({ params }: { params: PageProps<"/who/[id]/edit">["params"] }) {
  const { id } = await params;
  const [deviceId, { data: person }] = await Promise.all([
    getDeviceId(),
    createAdminClient()
      .from("people")
      .select("id, name, signature_strokes, created_by_device_id")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!person || person.created_by_device_id !== deviceId) notFound();

  return (
    <PersonForm
      person={{ id: person.id, name: person.name, signature: person.signature_strokes as unknown as StrokeDoc }}
    />
  );
}
