"use client";
import Link from "next/link";
import { useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { canAccess } from "../operations";
import { resources, record, display, label } from "../resources";
import { useStaffRoles } from "./admin-shell";
export function AdminReports({ overview = false }: { overview?: boolean }) {
  const roles = useStaffRoles();
  const allowed = canAccess(roles, ["admin", "finance"]);
  const report = useDataQuery(
    "adminQuery",
    { operation: "reports" },
    undefined,
    { enabled: allowed },
  );
  if (!allowed)
    return overview ? null : <p>Your role does not allow financial reports.</p>;
  const data = record(report.data);
  const fields = overview
    ? ["users", "providers", "jobs", "disputes"]
    : [
        "collectedMinor",
        "paidOutMinor",
        "refundedMinor",
        "earnedCommissionMinor",
        "reservedClientFundsMinor",
        "knownProcessingFeesMinor",
        "missingProcessingFeeCount",
      ];
  return (
    <section>
      {!overview && (
        <>
          <h1>Financial reports</h1>
          <p className="admin-note">
            These are verified ledger totals, not bank balance or profit. Client
            funds must remain available for eligible refunds and provider
            obligations. Transfer, custody and operating costs are not included.
          </p>
        </>
      )}
      <button
        disabled={report.isFetching}
        onClick={() => void report.refetch()}
      >
        Refresh report
      </button>
      {report.isPending ? (
        <p role="status">Loading report…</p>
      ) : report.isError ? (
        <p role="alert">{errorMessage(report.error)}</p>
      ) : (
        <>
          <div className="admin-stats">
            {fields.map((field) => (
              <article className="admin-stat" key={field}>
                <span>{label(field)}</span>
                <strong>{display(field, data[field])}</strong>
              </article>
            ))}
          </div>
          <p className="admin-muted">As of {display("asOf", data.asOf)}</p>
        </>
      )}
    </section>
  );
}
export function AdminOverview() {
  const roles = useStaffRoles();
  return (
    <section>
      <h1>Staff dashboard</h1>
      <p>
        Review applications, manage platform records and track financial
        operations according to your assigned permissions.
      </p>
      <AdminReports overview />
      <div className="admin-links">
        {Object.entries(resources)
          .filter(([, resource]) => canAccess(roles, resource.roles))
          .map(([section, resource]) => (
            <Link key={section} href={`/admin/${section}`}>
              <h2>{resource.title}</h2>
              <p>{resource.description}</p>
            </Link>
          ))}
      </div>
      {!canAccess(roles, ["admin", "reviewer", "finance"]) && (
        <p>
          Your support role currently grants access to staff security.
          Operational permissions must be assigned by an administrator.
        </p>
      )}
    </section>
  );
}
