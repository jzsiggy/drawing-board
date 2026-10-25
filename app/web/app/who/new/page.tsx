import type { Metadata } from "next";

import { PersonForm } from "../PersonForm";

export const metadata: Metadata = { title: "Add yourself · Drawing Board" };

export default function NewPersonPage() {
  return <PersonForm />;
}
