"use client";
import Link from "next/link";
import { useDataQuery } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
    <section className={overview ? "admin-report-block" : "admin-report-page"}>
      {!overview && (
        <>
          <div className="admin-page-intro admin-page-intro-compact">
            <span className="admin-eyebrow">Finance</span>
            <h1>Financial reports</h1>
            <p>
              Verified ledger totals for collections, payouts, refunds and
              platform revenue.
            </p>
          </div>
          <p className="admin-note">
            These are verified ledger totals, not bank balance or profit. Client
            funds must remain available for eligible refunds and provider
            obligations. Transfer, custody and operating costs are not included.
          </p>
        </>
      )}
      <button
        className="admin-refresh-button"
        disabled={report.isFetching}
        onClick={() => void report.refetch()}
      >
        Refresh report
      </button>
      {report.isPending ? (
        <div className="admin-stat-skeletons" role="status">
          <span className="admin-sr-only">Loading report…</span>
          {fields.map((field) => (
            <div className="admin-stat-skeleton" key={field} />
          ))}
        </div>
      ) : report.isError ? (
        <div className="admin-feedback admin-feedback-error" role="alert">
          <span>
            <strong>Report unavailable.</strong>
            <small>{errorMessage(report.error)}</small>
          </span>
          <button onClick={() => void report.refetch()}>Try again</button>
        </div>
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
          <p className="admin-muted admin-report-timestamp">
            Updated {display("asOf", data.asOf)}
          </p>
        </>
      )}
    </section>
  );
}
export function AdminOverview() {
  const roles = useStaffRoles();
  const workspaces = Object.entries(resources).filter(([, resource]) =>
    canAccess(roles, resource.roles),
  );
  const hasFinancialAccess = canAccess(roles, ["admin", "finance"]);
  return (
    <section className="admin-dashboard">
      <header className="admin-page-intro admin-dashboard-intro">
        <span className="admin-eyebrow">Operations workspace</span>
        <h1>Staff dashboard</h1>
        <p>
          Review applications, manage platform records and track operations
          from one place.
        </p>
      </header>
      {hasFinancialAccess && (
        <section
          className="admin-overview-section"
          aria-labelledby="admin-pulse-heading"
        >
          <div className="admin-section-heading">
            <div>
              <span className="admin-eyebrow">Platform pulse</span>
              <h2 id="admin-pulse-heading">At a glance</h2>
            </div>
            <span className="admin-section-note">Live ledger summary</span>
          </div>
          <AdminReports overview />
        </section>
      )}
      <section
        className="admin-overview-section"
        aria-labelledby="admin-workspaces-heading"
      >
        <div className="admin-section-heading">
          <div>
            <span className="admin-eyebrow">Your permissions</span>
            <h2 id="admin-workspaces-heading">Workspaces</h2>
          </div>
          {workspaces.length > 0 && (
            <span className="admin-section-note">Choose an area to manage</span>
          )}
        </div>
        {workspaces.length ? (
          <div className="admin-links">
            {workspaces.map(([section, resource]) => (
              <Link key={section} href={`/admin/${section}`}>
                <span className="admin-workspace-kicker">Workspace</span>
                <h2>{resource.title}</h2>
                <p>{resource.description}</p>
                <span className="admin-card-arrow" aria-hidden="true">
                  Open workspace <b>↗</b>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="shield"
            className="admin-empty-state admin-workspace-empty"
            title="No operational workspaces assigned"
            description="Your current role includes staff security. An administrator can assign additional workspace access when needed."
            action={
              <Button href="/admin/security" variant="secondary">
                Review staff security
              </Button>
            }
          />
        )}
      </section>
    </section>
  );
}
