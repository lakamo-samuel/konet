"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import {
  canAccess,
  type AdminQuery,
  type Params,
  type AdminCommand,
} from "../operations";
import {
  resources,
  display,
  label,
  record,
  records,
  text,
  type Resource,
} from "../resources";
import { useStaffRoles } from "./admin-shell";
import { AdminAction } from "./admin-action";
export function AdminTable({
  rows,
  columns,
  onSelect,
  section,
  emptyTitle = "No related records yet",
  emptyDescription = "Records will appear here when they are available.",
  emptyAction,
}: {
  rows: Record<string, unknown>[];
  columns: string[];
  onSelect?: (row: Record<string, unknown>) => void;
  section?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}) {
  if (!rows.length)
    return (
      <EmptyState
        icon={section === "disputes" ? "shield" : "grid"}
        className="admin-empty-state"
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((key) => (
              <th key={key} scope="col">
                {label(key)}
              </th>
            ))}
            {(section || onSelect) && <th scope="col">Details</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={typeof row.id === "string" ? row.id : index}>
              {columns.map((key) => (
                <td key={key}>{display(key, row[key])}</td>
              ))}
              {section ? (
                <td>
                  <Link
                    href={`/admin/${section}/${encodeURIComponent(String(row.id))}`}
                  >
                    View details <span aria-hidden="true">↗</span>
                  </Link>
                </td>
              ) : onSelect ? (
                <td>
                    <button onClick={() => onSelect(row)}>View details</button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function AdminResource({
  section,
  configuration,
  params = {},
}: {
  section: string;
  configuration?: Resource;
  params?: Params;
}) {
  const resource = configuration ?? resources[section];
  const roles = useStaffRoles();
  const [status, setStatus] = useState(resource.defaultStatus ?? "");
  const [email, setEmail] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(
    null,
  );
  const [creating, setCreating] = useState(false);
  const Heading = configuration ? "h2" : "h1";
  const allowed = canAccess(roles, resource.roles);
  const query = useDataQuery(
    "adminQuery",
    {
      operation: resource.query,
      params,
      filters: {
        ...(resource.paginated ? { limit: 20, offset } : {}),
        ...(status ? { status } : {}),
        ...(searchEmail ? { email: searchEmail } : {}),
      },
    },
    undefined,
    {
      enabled: allowed,
      refetchInterval: resource.query === "reconciliations" ? 15_000 : false,
    },
  );
  if (!allowed)
    return (
      <section className="admin-permission-state">
        <span className="admin-eyebrow">Restricted workspace</span>
        <h1>Permission required</h1>
        <p>Your staff role does not allow access to this area.</p>
      </section>
    );
  const rows = records(query.data);
  const emptyTitle = offset
    ? "No records on this page"
    : searchEmail
      ? "No matching user accounts"
      : status
        ? `No ${resource.title.toLowerCase()} in this status`
        : `No ${resource.title.toLowerCase()} yet`;
  const emptyDescription = offset
    ? "There are no records in this part of the list. Return to the previous page to keep browsing."
    : searchEmail
      ? `No account matches ${searchEmail}. Check the address or clear the search.`
      : status
        ? "Try another status filter to see the rest of the records."
        : "New records will appear here as the platform receives or creates them.";
  return (
    <section className="admin-resource-page">
      <header className="admin-page-intro admin-page-intro-compact">
        <span className="admin-eyebrow">Record management</span>
        <Heading>{resource.title}</Heading>
        <p>{resource.description}</p>
      </header>
      <div className="admin-toolbar">
        {resource.statuses && (
          <label>
            Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setOffset(0);
                setSelected(null);
              }}
            >
              {!resource.defaultStatus && <option value="">All</option>}
              {resource.statuses.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        )}
        {section === "users" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearchEmail(email.trim());
              setOffset(0);
              setSelected(null);
            }}
          >
            <label>
              Find by email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Exact email address"
              />
            </label>
            <button type="submit">Search</button>
            {searchEmail && (
              <button
                type="button"
                onClick={() => {
                  setEmail("");
                  setSearchEmail("");
                  setOffset(0);
                }}
              >
                Clear
              </button>
            )}
          </form>
        )}
        <button
          className="admin-refresh-button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh records
        </button>
        {resource.create && (
          <button
            className="admin-create-button"
            onClick={() => setCreating(!creating)}
          >
            {creating
              ? "Close form"
              : resource.title === "Reconciliation"
                ? "Start reconciliation"
                : "Add new"}
          </button>
        )}
      </div>
      {creating && resource.create && (
        <AdminAction
          operation={resource.create}
          params={params}
          onSuccess={() => setCreating(false)}
        />
      )}
      {query.isSuccess && (
        <div className="admin-results-bar" aria-live="polite">
          <strong>
            {rows.length
              ? `Showing ${rows.length} ${rows.length === 1 ? "record" : "records"}`
              : "No records to show"}
          </strong>
          <span>
            {status
              ? `Status: ${status.replaceAll("_", " ")}`
              : searchEmail
                ? `Email: ${searchEmail}`
                : "Current page"}
          </span>
        </div>
      )}
      {query.isPending ? (
        <div className="admin-table-skeleton" role="status">
          <span className="admin-sr-only">Loading records…</span>
          {Array.from({ length: 5 }, (_, index) => (
            <div className="admin-skeleton-row" key={index}>
              <i />
              <i />
              <i />
              <i />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <div role="alert" className="admin-feedback admin-feedback-error">
          <span>
            <strong>Records could not be loaded.</strong>
            <small>{errorMessage(query.error)}</small>
          </span>
          <button onClick={() => void query.refetch()}>Try again</button>
        </div>
      ) : (
        <AdminTable
          rows={rows}
          columns={resource.columns}
          section={resource.detail ? section : undefined}
          onSelect={!resource.detail ? setSelected : undefined}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyAction={
            resource.create && !offset ? (
              <Button
                variant="secondary"
                onClick={() => setCreating(true)}
              >
                Add the first record
              </Button>
            ) : undefined
          }
        />
      )}
      {resource.paginated && (
        <div className="admin-pagination">
          <button
            disabled={!offset || query.isFetching}
            onClick={() => {
              setOffset(Math.max(0, offset - 20));
              setSelected(null);
            }}
          >
            Previous
          </button>
          <span>
            {rows.length
              ? `Records ${offset + 1}–${offset + rows.length}`
              : "No records on this page"}
          </span>
          <button
            disabled={rows.length < 20 || query.isFetching}
            onClick={() => {
              setOffset(offset + 20);
              setSelected(null);
            }}
          >
            Next
          </button>
        </div>
      )}
      {selected && (
        <section className="admin-detail">
          <button onClick={() => setSelected(null)}>Close record</button>
          <RecordDetails data={selected} />
          {resource.actions?.map((operation) => (
            <AdminAction
              key={`${operation}:${selected.id}`}
              operation={operation}
              params={{ ...params, id: String(selected.id) }}
              initial={selected}
              onSuccess={() => setSelected(null)}
            />
          ))}
        </section>
      )}
    </section>
  );
}
const hidden = new Set([
  "passwordHash",
  "recipientCode",
  "fingerprint",
  "idempotencyKey",
  "studentNumberHash",
  "evidenceObjectKey",
  "payloadHash",
  "leaseUntil",
  "leaseToken",
  "recoveryHashes",
  "secretCiphertext",
  "pendingCiphertext",
]);
export function RecordDetails({ data }: { data: Record<string, unknown> }) {
  const scalar = Object.entries(data).filter(
    ([key, value]) =>
      !hidden.has(key) && (value === null || typeof value !== "object"),
  );
  const nested = Object.entries(data).filter(
    ([key, value]) =>
      !hidden.has(key) && value !== null && typeof value === "object",
  );
  return (
    <>
      <section className="admin-detail-section">
        <dl>
          {scalar.map(([key, value]) => (
            <div key={key}>
              <dt>{label(key)}</dt>
              <dd>{display(key, value)}</dd>
            </div>
          ))}
        </dl>
      </section>
      {nested.map(([key, value]) => (
        <section key={key} className="admin-detail-section">
          <h3>{label(key)}</h3>
          {Array.isArray(value) ? (
            value.length ? (
              value.every((item) => typeof item !== "object") ? (
                <p>{value.map(text).join(" · ")}</p>
              ) : (
                <AdminTable
                  rows={records(value)}
                  columns={Array.from(
                    new Set(
                      records(value).flatMap((row) =>
                        Object.keys(row).filter(
                          (field) =>
                            !hidden.has(field) &&
                            typeof row[field] !== "object",
                        ),
                      ),
                    ),
                  ).slice(0, 8)}
                />
              )
            ) : (
              <EmptyState
                icon="grid"
                className="admin-empty-state admin-nested-empty-state"
                title="No related records"
                description="There are no associated records to show here yet."
              />
            )
          ) : (
            <RecordDetails data={record(value)} />
          )}
        </section>
      ))}
    </>
  );
}
function EvidenceAccess({ id }: { id: string }) {
  const query = useDataQuery(
    "adminQuery",
    { operation: "evidence", params: { id } },
    undefined,
    { enabled: false },
  );
  const data = record(query.data);
  let url: string | null = null;
  try {
    const target = new URL(String(data.downloadUrl));
    if (
      target.protocol === "https:" &&
      ["api.cloudinary.com", "res.cloudinary.com"].includes(target.hostname) &&
      !target.username &&
      !target.password
    )
      url = target.toString();
  } catch {
    /* A link appears only after a valid signed download response. */
  }
  return (
    <section className="admin-detail-section">
      <h3>Private evidence document</h3>
      <p>
        Document access is audited. The download link expires after five
        minutes.
      </p>
      <button disabled={query.isFetching} onClick={() => void query.refetch()}>
        {query.isFetching ? "Preparing document…" : "Prepare secure download"}
      </button>
      {url && (
        <p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Download evidence document
          </a>
        </p>
      )}
      {query.isError && <p role="alert">{errorMessage(query.error)}</p>}
    </section>
  );
}
export function AdminDetail({ section, id }: { section: string; id: string }) {
  const resource = resources[section];
  const roles = useStaffRoles();
  const allowed = canAccess(roles, resource.roles);
  const query = useDataQuery(
    "adminQuery",
    { operation: resource.detail as AdminQuery, params: { id } },
    undefined,
    {
      enabled: allowed,
      refetchInterval: section === "reconciliations" ? 15_000 : false,
    },
  );
  if (!allowed)
    return <p>Your staff role does not allow access to this record.</p>;
  const data = record(query.data);
  const initials = {
    ...data,
    revision: section === "providers" ? data.reviewRevision : data.revision,
  };
  const eligible = (operation: AdminCommand) =>
    operation === "refund"
      ? ["funded", "held"].includes(String(data.status))
      : operation === "retryPayout"
        ? data.status === "failed"
        : operation === "providerDecision"
          ? data.reviewStatus === "pending"
          : operation === "evidenceDecision" || operation === "studentDecision"
            ? data.status === "pending"
            : operation === "disputeDecision"
              ? ["open", "under_review"].includes(String(data.status))
              : true;
  return (
    <section className="admin-detail">
      <Link className="admin-back-link" href={`/admin/${section}`}>← Back to {resource.title}</Link>
      <div className="admin-page-intro admin-page-intro-compact">
        <span className="admin-eyebrow">Record details</span>
        <h1>{resource.title}</h1>
        <p>Review the record and its related information.</p>
      </div>
      <button className="admin-refresh-button" disabled={query.isFetching} onClick={() => void query.refetch()}>
        Refresh record
      </button>
      {query.isPending ? (
        <div className="admin-detail-skeleton" role="status">
          <span className="admin-sr-only">Loading record…</span>
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : query.isError ? (
        <div className="admin-feedback admin-feedback-error" role="alert">
          <span>
            <strong>Record could not be loaded.</strong>
            <small>{errorMessage(query.error)}</small>
          </span>
          <button onClick={() => void query.refetch()}>Try again</button>
        </div>
      ) : (
        <>
          <RecordDetails data={data} />
          {typeof data.uploadId === "string" && (
            <EvidenceAccess id={data.uploadId} />
          )}
          <div>
            {resource.actions?.filter(eligible).map((operation) => (
              <AdminAction
                key={`${operation}:${data.updatedAt ?? data.revision ?? data.reviewRevision ?? data.status}`}
                operation={operation}
                params={{ id }}
                initial={initials}
              />
            ))}
          </div>
          {section === "users" &&
            Array.isArray(data.roles) &&
            data.roles
              .filter((role): role is string => typeof role === "string")
              .map((role) => (
                <AdminAction
                  key={role}
                  operation="revokeRole"
                  params={{ id, role }}
                />
              ))}
        </>
      )}
      {section === "universities" && !query.isError && !query.isPending && (
        <>
          <AdminResource
            section="campuses"
            params={{ universityId: id }}
            configuration={{
              title: "Campuses",
              description:
                "Create, edit or archive campuses for this university.",
              query: "campuses",
              roles: ["admin"],
              columns: ["name", "slug", "isActive"],
              create: "createCampus",
              actions: ["updateCampus", "archiveCampus"],
            }}
          />
          <AdminResource
            section="domains"
            params={{ universityId: id }}
            configuration={{
              title: "Approved email domains",
              description:
                "Only approve domains controlled by the university. Approval allows students with those addresses to verify using an email code.",
              query: "domains",
              roles: ["admin"],
              columns: ["domain", "approved"],
              create: "createDomain",
              actions: ["updateDomain", "deleteDomain"],
            }}
          />
        </>
      )}
    </section>
  );
}
