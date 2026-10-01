"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
import type { User } from "@/types/domain";
export function AccountSettingsForm({ user, campuses }: { user: User; campuses: string[] }) {
  const [saved, setSaved] = useState(false);
  const save = useDataCommand("saveProfile");
  return <form className="surface-panel form-stack" onSubmit={async event => { event.preventDefault(); const values = new FormData(event.currentTarget); try { await save.mutateAsync({ name: String(values.get("name") ?? "").trim(), email: String(values.get("email") ?? "").trim(), campus: String(values.get("campus") ?? "") }); setSaved(true); } catch { /* Error is shown below. */ } }}>
    <label className="field">Full name<input name="name" defaultValue={user.name} required onChange={() => setSaved(false)} /></label><label className="field">Email<input name="email" type="email" defaultValue={user.email} required onChange={() => setSaved(false)} /></label><label className="field">Campus<Select label="Campus" name="campus" defaultValue={user.campus} options={campuses.map(label => ({ value: label, label }))} /></label>
    {save.isError && <p className="field-error" role="alert">{errorMessage(save.error)}</p>}{saved && <p role="status" className="text-sm text-[var(--green)]">Changes saved.</p>}
    <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button>
  </form>;
}
