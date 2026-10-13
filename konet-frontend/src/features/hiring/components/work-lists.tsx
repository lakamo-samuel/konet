"use client";
import { formatDateTime } from "@/lib/formatters/date";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { formatNaira } from "@/lib/formatters/currency";
import { WorkspaceSkeleton } from "@/components/ui/workspace-skeleton";
export function RequestList({ provider = false }: { provider?: boolean }) {
  const [offset, setOffset] = useState(0);
  const user = useDataQuery("currentUser", {});
  const requests = useDataQuery("requests", { offset }, undefined, {
    refetchInterval: 15000,
  });
  if (user.isPending || requests.isPending)
    return <WorkspaceSkeleton variant="requests" />;
  if (user.isError || requests.isError)
    return <p role="alert">{errorMessage(user.error ?? requests.error)}</p>;
  const rows = requests.data.filter((r) =>
    provider
      ? r.providerId === user.data.providerProfileId
      : r.clientId === user.data.id,
  );
  return (
    <div className="form-stack">
      {!rows.length && <EmptyState icon="message" title={offset ? "No requests on this page" : "No requests yet"} description="When you send or receive a service request, you can track it here." action={<Button href="/discover">Find a provider</Button>} />}
      {rows.map((r) => (
        <article className="surface-panel work-record" key={r.id}>
          <h3>{r.description.slice(0, 100)}</h3>
          <p>
            {r.status.replaceAll("_", " ")} ·{" "}
            {r.requestedAt
              ? formatDateTime(r.requestedAt)
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
    return <WorkspaceSkeleton variant="jobs" />;
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
        <EmptyState icon="briefcase" title={offset ? "No jobs on this page" : "No jobs yet"} description="Your jobs appear here after a quote is accepted. Find a provider and start a conversation to get going." action={<Button href="/discover">Explore services</Button>} />
      )}
      {rows.map((j) => (
        <article className="surface-panel work-record" key={j.id}>
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
