"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
export function OnboardingForm({ step, next, children }: { step: "profile" | "service" | "portfolio" | "verification"; next: string; children: React.ReactNode }) {
  const router = useRouter();
  const save = useDataCommand("saveOnboarding");
  return <form className="grid gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-8" onSubmit={async event => {
    event.preventDefault();
    const values: Record<string, string> = {};
    for (const [key, value] of new FormData(event.currentTarget)) values[key] = value instanceof File ? value.name : String(value);
    try { await save.mutateAsync({ step, values }); router.push(next); } catch { /* Error is shown below. */ }
  }}>
    {children}
    {save.isError && <p role="alert" className="text-sm text-red-700">{errorMessage(save.error)}</p>}
    <div className="mt-2 flex flex-wrap gap-3 border-t border-[var(--border)] pt-6"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save and continue"}</Button><Button type="button" variant="quiet" onClick={() => router.back()}>Back</Button></div>
  </form>;
}
