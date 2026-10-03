"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { formatNaira } from "@/lib/formatters/currency";
export function RequestList({ provider = false }: { provider?: boolean }) {
  const [offset, setOffset] = useState(0);
  const user = useDataQuery("currentUser", {});
  const requests = useDataQuery("requests", { offset }, undefined, {
    refetchInterval: 15000,
  });
  if (user.isPending || requests.isPending)
    return <p role="status">Loading requests…</p>;
  if (user.isError || requests.isError)
    return <p role="alert">{errorMessage(user.error ?? requests.error)}</p>;
  const rows = requests.data.filter((r) =>
    provider
      ? r.providerId === user.data.providerProfileId
      : r.clientId === user.data.id,
  );
  return (
    <div className="form-stack">
      {!rows.length && <p>No requests to show.</p>}
      {rows.map((r) => (
        <article className="surface-panel" key={r.id}>
          <h3>{r.description.slice(0, 100)}</h3>
          <p>
            {r.status.replaceAll("_", " ")} ·{" "}
            {r.requestedAt
              ? new Date(r.requestedAt).toLocaleString()
              : "Date to be agreed"}
          </p>
          <Button href={`/requests/${r.id}`} variant="secondary">
            View request
          </Button>
        </article>
      ))}
      <div>
        <Button
          variant="secondary"
          disabled={offset === 0}
          onClick={() => setOffset(offset - 20)}
        >
          Previous page
        </Button>
        <Button
          variant="secondary"
          disabled={requests.data.length < 20}
          onClick={() => setOffset(offset + 20)}
        >
          Next page
        </Button>
      </div>
    </div>
  );
}
export function JobList() {
  const [offset, setOffset] = useState(0);
  const user = useDataQuery("currentUser", {});
  const jobs = useDataQuery(
    "jobs",
    { userId: user.data?.id ?? "", offset },
    undefined,
    { enabled: !!user.data, refetchInterval: 15000 },
  );
  const [tab, setTab] = useState("all");
  if (user.isError) return <p role="alert">{errorMessage(user.error)}</p>;
  if (user.isPending || jobs.isPending)
    return <p role="status">Loading jobs…</p>;
  if (user.isError || jobs.isError)
    return <p role="alert">{errorMessage(user.error ?? jobs.error)}</p>;
  const rows = jobs.data.filter(
    (j) =>
      tab === "all" ||
      (tab === "client"
        ? j.clientId === user.data.id
        : j.providerId === user.data.providerProfileId),
  );
  return (
    <div className="form-stack">
      <label className="field">
        Show jobs
        <select value={tab} onChange={(e) => setTab(e.target.value)}>
          <option value="all">All my jobs</option>
          <option value="client">As a client</option>
          {user.data.providerProfileId && (
            <option value="provider">As a provider</option>
          )}
        </select>
      </label>
      {!rows.length && (
        <p>No jobs to show. Accepted quotes create jobs here.</p>
      )}
      {rows.map((j) => (
        <article className="surface-panel" key={j.id}>
          <h3>Job {j.id.slice(0, 8)}</h3>
          <p>
            {j.status.replaceAll("_", " ")} ·{" "}
            {formatNaira(j.agreedAmountMinor / 100)}
          </p>
          <Button href={`/jobs/${j.id}`} variant="secondary">
            Open job
          </Button>
        </article>
      ))}
      <div>
        <Button
          variant="secondary"
          disabled={offset === 0}
          onClick={() => setOffset(offset - 20)}
        >
          Previous page
        </Button>
        <Button
          variant="secondary"
          disabled={jobs.data.length < 20}
          onClick={() => setOffset(offset + 20)}
        >
          Next page
        </Button>
      </div>
      <Button href="/requests" variant="secondary">
        View my requests
      </Button>
    </div>
  );
}
