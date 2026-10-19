"use client";
import { formatDateTime } from "@/lib/formatters/date";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { formatNaira } from "@/lib/formatters/currency";
import { WorkspaceSkeleton } from "@/components/ui/workspace-skeleton";
import { CollectionPagination } from "@/components/ui/collection-pagination";
import { CollectionToolbar } from "@/components/ui/collection-toolbar";
import { Select } from "@/components/ui/select";
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
      {(offset > 0 || requests.data.length > 0) && (
        <CollectionPagination
          offset={offset}
          count={requests.data.length}
          isFetching={requests.isFetching}
          onOffsetChange={setOffset}
          itemName="requests"
        />
      )}
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
      <CollectionToolbar>
        <label className="collection-filter">
          <span>Show jobs</span>
          <Select
            label="Filter jobs by role"
            value={tab}
            onValueChange={(value) => setTab(value)}
            options={[
              { value: "all", label: "All my jobs" },
              { value: "client", label: "As a client" },
              ...(user.data.providerProfileId
                ? [{ value: "provider", label: "As a provider" }]
                : []),
            ]}
          />
        </label>
      </CollectionToolbar>
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
      {(offset > 0 || jobs.data.length > 0) && (
        <CollectionPagination
          offset={offset}
          count={jobs.data.length}
          isFetching={jobs.isFetching}
          onOffsetChange={setOffset}
          itemName="jobs"
        />
      )}
    </div>
  );
}
