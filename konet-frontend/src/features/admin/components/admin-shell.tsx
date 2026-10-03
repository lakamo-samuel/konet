"use client";
import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@/types/domain";
import { useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { canAccess, isStaff } from "../operations";
import { resources, record } from "../resources";
import { AdminSecurity } from "./admin-security";
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
  const security = useDataQuery(
    "adminQuery",
    { operation: "security" },
    undefined,
    { enabled: isStaff(roles), refetchInterval: 30_000 },
  );
  const status = record(security.data);
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
          <Link href="/admin" className="wordmark">
            konet <span>staff</span>
          </Link>
          <p>{user.data?.name}</p>
          <nav aria-label="Staff navigation">
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
          <Link href="/discover">Return to marketplace</Link>
          <SignOutButton />
        </aside>
        <main className="admin-main">
          <div className="admin-topbar">
            <span>Staff dashboard</span>
            <span>{roles.join(" · ")}</span>
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
            <AdminSecurity status={status} />
          ) : !status.verified ? (
            <section>
              <h1>Verify staff access</h1>
              <p>
                Set up or verify your authenticator before opening staff tools.
              </p>
              <Link href="/admin/security">Open staff security</Link>
            </section>
          ) : (
            children
          )}
        </main>
      </div>
    </StaffContext.Provider>
  );
}
