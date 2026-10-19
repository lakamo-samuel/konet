"use client";
import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@/types/domain";
import { useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { canAccess, isStaff } from "../operations";
import { resources, record } from "../resources";
import { AdminSecurity } from "./admin-security";
import { Button } from "@/components/ui/button";
import { staffVerificationDestination } from "../lib/staff-navigation";
const StaffContext = createContext<readonly string[]>([]);
export const useStaffRoles = () => useContext(StaffContext);
export function AdminShell({
  initialUser,
  children,
}: {
  initialUser: User;
  children: ReactNode;
}) {
  const user = useDataQuery("currentUser", {}, initialUser, {
    refetchInterval: 30_000,
  });
  const roles = user.data?.roles ?? [];
  const path = usePathname();
  const router = useRouter();
  const staffName = user.data?.name ?? "Staff member";
  const initials = staffName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const workspaceTitle =
    path === "/admin"
      ? "Overview"
      : path === "/admin/security"
        ? "Staff security"
        : path === "/admin/reports"
          ? "Financial reports"
          : Object.entries(resources).find(([section]) =>
                path.startsWith(`/admin/${section}`),
              )?.[1].title ?? "Staff dashboard";
  const security = useDataQuery(
    "adminQuery",
    { operation: "security" },
    undefined,
    { enabled: isStaff(roles), refetchInterval: 30_000 },
  );
  const status = record(security.data);
  async function openRequestedStaffPage() {
    const refreshed = await security.refetch();
    if (!record(refreshed.data).verified) return;

    const requestedPath = new URLSearchParams(window.location.search).get(
      "returnTo",
    );
    router.replace(staffVerificationDestination(requestedPath));
    router.refresh();
  }
  if (!isStaff(roles) || user.isError)
    return (
      <main className="admin-denied">
        <h1>Staff access unavailable</h1>
        <p>
          {user.isError
            ? errorMessage(user.error)
            : "Your account does not have permission to open staff tools."}
        </p>
        <Link href="/discover">Return to Konet</Link>
      </main>
    );
  return (
    <StaffContext.Provider value={roles}>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <Link href="/admin" className="wordmark">
              konet <span>staff</span>
            </Link>
            <p>Operations workspace</p>
          </div>
          <div className="admin-staff-card">
            <span className="admin-staff-avatar" aria-hidden="true">
              {initials || "S"}
            </span>
            <span className="admin-staff-identity">
              <strong>{staffName}</strong>
              <small>{roles.join(" · ")}</small>
            </span>
          </div>
          <nav aria-label="Staff navigation">
            <span className="admin-nav-heading">Workspace</span>
            <Link
              href="/admin"
              aria-current={path === "/admin" ? "page" : undefined}
            >
              Overview
            </Link>
            {Object.entries(resources)
              .filter(([, resource]) => canAccess(roles, resource.roles))
              .map(([section, resource]) => (
                <Link
                  key={section}
                  href={`/admin/${section}`}
                  aria-current={
                    path.startsWith(`/admin/${section}`) ? "page" : undefined
                  }
                >
                  {resource.title}
                </Link>
              ))}
            {canAccess(roles, ["admin", "finance"]) && (
              <Link
                href="/admin/reports"
                aria-current={path === "/admin/reports" ? "page" : undefined}
              >
                Financial reports
              </Link>
            )}
            <Link
              href="/admin/security"
              aria-current={path === "/admin/security" ? "page" : undefined}
            >
              Staff security
            </Link>
          </nav>
          <div className="admin-sidebar-footer">
            <Link href="/discover">Return to marketplace <span aria-hidden="true">↗</span></Link>
            <SignOutButton />
          </div>
        </aside>
        <main className="admin-main">
          <div className="admin-topbar">
            <div className="admin-breadcrumb">
              <span>Konet staff</span>
              <span aria-hidden="true">/</span>
              <strong>{workspaceTitle}</strong>
            </div>
            <span className="admin-session-badge">{roles.join(" · ")}</span>
          </div>
          {security.isPending ? (
            <p role="status">Checking staff security…</p>
          ) : security.isError ? (
            <section>
              <h1>Staff security unavailable</h1>
              <p role="alert">{errorMessage(security.error)}</p>
              <button onClick={() => void security.refetch()}>Retry</button>
            </section>
          ) : path === "/admin/security" ? (
            <AdminSecurity status={status} onVerified={openRequestedStaffPage} />
          ) : !status.verified ? (
            <section className="admin-access-gate">
              <span className="admin-access-eyebrow">Staff security</span>
              <h1>Verify staff access</h1>
              <p>
                Confirm your authenticator to continue to the staff page you
                requested. You’ll return there automatically after verification.
              </p>
              <Button
                href={`/admin/security?returnTo=${encodeURIComponent(path)}`}
              >
                Verify and continue
              </Button>
            </section>
          ) : (
            children
          )}
        </main>
      </div>
    </StaffContext.Provider>
  );
}
