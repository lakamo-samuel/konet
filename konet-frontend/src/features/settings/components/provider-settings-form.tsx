"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
import type { ProviderProfile } from "@/types/domain";
const responseOptions = ["Within 15 minutes", "Within 1 hour", "Within a day"].map(label => ({ value: label, label }));
export function ProviderSettingsForm({ provider }: { provider: ProviderProfile }) {
  const [saved, setSaved] = useState(false);
  const save = useDataCommand("saveProvider");
  return <form className="surface-panel form-stack" onSubmit={async event => { event.preventDefault(); const values = new FormData(event.currentTarget); try { await save.mutateAsync({ professionalTitle: String(values.get("professionalTitle") ?? "").trim(), responseTime: String(values.get("responseTime") ?? ""), available: values.get("available") === "on" }); setSaved(true); } catch { /* Error is shown below. */ } }}>
    <label className="field">Professional title<input name="professionalTitle" defaultValue={provider.professionalTitle} required onChange={() => setSaved(false)} /></label><label className="field">Response time<Select label="Response time" name="responseTime" defaultValue={provider.responseTime} options={responseOptions.some(option => option.value === provider.responseTime) ? responseOptions : [{ value: provider.responseTime, label: provider.responseTime }, ...responseOptions]} /></label><label className="check-row"><input name="available" type="checkbox" defaultChecked={provider.available} onChange={() => setSaved(false)} /> Available for new requests</label>
    {save.isError && <p className="field-error" role="alert">{errorMessage(save.error)}</p>}{saved && <p role="status" className="text-sm text-[var(--green)]">Provider settings saved.</p>}
    <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save provider settings"}</Button>
  </form>;
}
