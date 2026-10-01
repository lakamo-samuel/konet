"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
export function RequestForm({ providerId, services }: { providerId: string; services: { id: string; name: string }[] }) {
  const [sent, setSent] = useState(false);
  const create = useDataCommand("createRequest");
  if (sent) return <div className="success-state"><h2>Request sent</h2><p>The provider can now review your brief and send a quote.</p><Button href="/discover">Explore more services</Button></div>;
  return <form className="form-stack" onSubmit={async event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
      await create.mutateAsync({ providerId, serviceId: String(values.get("serviceId") ?? ""), date: String(values.get("date") ?? ""), time: String(values.get("time") ?? ""), location: String(values.get("location") ?? ""), budgetMin: Number(values.get("budgetMin")), budgetMax: Number(values.get("budgetMax")), details: String(values.get("details") ?? "") });
      setSent(true);
    } catch { /* Error is shown below. */ }
  }}>
    <label className="field">Service<Select label="Service" name="serviceId" required options={services.map(service => ({ value: service.id, label: service.name }))} /></label>
    <div className="form-columns"><label className="field">Date<input name="date" type="date" required /></label><label className="field">Time<input name="time" type="time" required /></label></div>
    <label className="field">Campus or meeting point<input name="location" required placeholder="Where should the work happen?" /></label>
    <div className="form-columns"><label className="field">Minimum budget (₦)<input name="budgetMin" type="number" min={0} required placeholder="15,000" /></label><label className="field">Maximum budget (₦)<input name="budgetMax" type="number" min={0} required placeholder="20,000" /></label></div>
    <label className="field">What do you need?<textarea name="details" rows={5} required placeholder="Share the outcome, timing, and any useful context." /></label>
    {create.isError && <p className="field-error" role="alert">{errorMessage(create.error)}</p>}
    <Button type="submit" disabled={create.isPending || services.length === 0}>{create.isPending ? "Sending…" : "Send service request"}</Button>
  </form>;
}
