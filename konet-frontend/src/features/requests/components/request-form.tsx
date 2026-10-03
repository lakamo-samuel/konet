"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
import { ngnToMinor, futureDate } from "@/lib/formatters/money-input";
export function RequestForm({
  providerId,
  services,
}: {
  providerId: string;
  services: { id: string; name: string }[];
}) {
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState("");
  const create = useDataCommand("createRequest");
  if (created)
    return (
      <div className="success-state">
        <h2>Request sent</h2>
        <p>The provider can review your brief and send a quote.</p>
        <Button href={`/requests/${created}`}>View request</Button>
      </div>
    );
  return (
    <form
      className="form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (create.isPending) return;
        setError("");
        const data = new FormData(event.currentTarget);
        try {
          const budgetMinMinor = ngnToMinor(
            String(data.get("budgetMin") ?? ""),
            true,
          );
          const budgetMaxMinor = ngnToMinor(
            String(data.get("budgetMax") ?? ""),
            true,
          );
          if (
            budgetMinMinor !== undefined &&
            budgetMaxMinor !== undefined &&
            budgetMinMinor > budgetMaxMinor
          )
            throw new Error("Minimum budget cannot exceed maximum budget.");
          const result = await create.mutateAsync({
            providerId,
            serviceId: String(data.get("serviceId")),
            description: String(data.get("description")).trim(),
            ...(budgetMinMinor === undefined ? {} : { budgetMinMinor }),
            ...(budgetMaxMinor === undefined ? {} : { budgetMaxMinor }),
            requestedAt: futureDate(String(data.get("requestedAt") ?? "")),
            location: String(data.get("location") ?? "").trim() || undefined,
          });
          setCreated(result.id);
        } catch (cause) {
          setError(errorMessage(cause));
        }
      }}
    >
      <label className="field">
        Service
        <select name="serviceId" required>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Preferred date and time (optional)
        <input name="requestedAt" type="datetime-local" />
      </label>
      <label className="field">
        Meeting point (optional)
        <input name="location" maxLength={255} />
      </label>
      <div className="form-columns">
        <label className="field">
          Minimum budget (₦, optional)
          <input name="budgetMin" type="number" min={0} step="0.01" />
        </label>
        <label className="field">
          Maximum budget (₦, optional)
          <input name="budgetMax" type="number" min={0} step="0.01" />
        </label>
      </div>
      <label className="field">
        What do you need?
        <textarea
          name="description"
          rows={5}
          required
          minLength={20}
          maxLength={10000}
        />
      </label>
      {!services.length && (
        <p>No active services are available for this provider.</p>
      )}
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={create.isPending || !services.length}>
        {create.isPending ? "Sending…" : "Send service request"}
      </Button>
    </form>
  );
}
