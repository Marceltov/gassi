import type { Metadata } from "next";
import { catalog } from "@/backend";
import { BackButton } from "@/components/BackButton";
import { ExerciseEditor, TreatKindEditor } from "@/components/CatalogEditor";

export const metadata: Metadata = { title: "Übungen und Leckerlis" };
export const dynamic = "force-dynamic";

export default async function Settings() {
  const c = await catalog();
  const [exercises, treatKinds] = await Promise.all([c.exercises(), c.treatKinds()]);
  return (
    <>
      <header className="mb-4">
        <BackButton fallback="/" />
        <h1 className="text-3xl font-extrabold tracking-tight">Übungen und Leckerlis</h1>
        <p className="text-muted">Was ihr trainiert und womit ihr belohnt.</p>
      </header>
      <ExerciseEditor exercises={exercises} />
      <TreatKindEditor treatKinds={treatKinds} />
    </>
  );
}
