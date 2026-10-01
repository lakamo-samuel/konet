"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
import type { Service } from "@/types/domain";
export function ServiceEditor({ providerId, service }: { providerId: string; service?: Service }) {
  const router = useRouter();
  const save = useDataCommand("saveService");
  return <form className="surface-panel form-stack" onSubmit={async event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try { await save.mutateAsync({ id: service?.id, providerId, name: String(values.get("name") ?? "").trim(), description: String(values.get("description") ?? "").trim(), startingPrice: Number(values.get("startingPrice")), pricingUnit: String(values.get("pricingUnit") ?? "per project") }); router.push("/provider/services"); } catch { /* Error is shown below. */ }
  }}>
    <label className="field">Service name<input name="name" defaultValue={service?.name} required /></label>
    <label className="field">Description<textarea name="description" rows={5} defaultValue={service?.description} required /></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="field">Starting price (₦)<input name="startingPrice" type="number" defaultValue={service?.startingPrice} min={500} required /></label><label className="field">Pricing unit<Select label="Pricing unit" name="pricingUnit" defaultValue={service?.pricingUnit} options={["per session", "per hour", "per project"].map(label => ({ value: label, label }))} /></label></div>
    {save.isError && <p role="alert" className="field-error">{errorMessage(save.error)}</p>}
    <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : service ? "Save service" : "Publish service"}</Button>
  </form>;
}
