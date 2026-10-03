import type { AdminCommand, AdminQuery, StaffRole } from "./operations";
export type Resource = {
  title: string;
  description: string;
  query: AdminQuery;
  detail?: AdminQuery;
  roles: StaffRole[];
  columns: string[];
  statuses?: string[];
  defaultStatus?: string;
  create?: AdminCommand;
  actions?: AdminCommand[];
  paginated?: boolean;
};
const admin: StaffRole[] = ["admin"],
  review: StaffRole[] = ["admin", "reviewer"],
  finance: StaffRole[] = ["admin", "finance"];
export const resources: Record<string, Resource> = {
  users: {
    title: "Accounts & staff",
    description:
      "Manage account access and assign staff responsibilities. Every change requires a reason.",
    query: "users",
    detail: "user",
    roles: admin,
    columns: [
      "fullName",
      "email",
      "accountStatus",
      "studentVerificationStatus",
    ],
    statuses: ["active", "suspended", "deactivated"],
    actions: ["accountStatus", "grantRole"],
    paginated: true,
  },
  "student-verifications": {
    title: "Student verification",
    description:
      "Review student documents. University email checks are handled automatically for approved domains.",
    query: "studentVerifications",
    detail: "studentVerification",
    roles: review,
    columns: ["userId", "method", "status", "createdAt"],
    statuses: ["pending", "verified", "rejected", "requires_more_information"],
    defaultStatus: "pending",
    actions: ["studentDecision"],
    paginated: true,
  },
  "provider-verifications": {
    title: "Provider evidence",
    description:
      "Review identity, work and optional CAC evidence. Identity and work must both be verified before provider approval.",
    query: "providerVerifications",
    detail: "providerVerification",
    roles: review,
    columns: ["providerId", "dimension", "status", "revision", "submittedAt"],
    statuses: ["pending", "verified", "rejected", "requires_more_information"],
    defaultStatus: "pending",
    actions: ["evidenceDecision"],
    paginated: true,
  },
  providers: {
    title: "Provider approvals",
    description:
      "Review complete profiles, services and portfolios after identity and work evidence have been verified.",
    query: "providers",
    detail: "provider",
    roles: review,
    columns: ["professionalTitle", "status", "reviewStatus", "submittedAt"],
    statuses: [
      "pending",
      "approved",
      "not_submitted",
      "rejected",
      "requires_more_information",
    ],
    defaultStatus: "pending",
    actions: ["providerDecision"],
    paginated: true,
  },
  disputes: {
    title: "Disputes",
    description:
      "Review the complaint and record a reasoned decision. Resolution queues the appropriate settlement; gateway confirmation determines completion.",
    query: "disputes",
    detail: "dispute",
    roles: finance,
    columns: ["reason", "status", "jobId", "createdAt"],
    statuses: [
      "open",
      "under_review",
      "resolved_for_client",
      "resolved_for_provider",
      "closed",
    ],
    actions: ["disputeDecision"],
    paginated: true,
  },
  payments: {
    title: "Payments & refunds",
    description:
      "Inspect payment records and request eligible full refunds. Amounts reflect the agreed job price and recorded commission.",
    query: "payments",
    detail: "payment",
    roles: finance,
    columns: [
      "amountMinor",
      "platformFeeMinor",
      "providerAmountMinor",
      "status",
      "createdAt",
    ],
    statuses: [
      "pending",
      "processing",
      "funded",
      "held",
      "release_pending",
      "released",
      "failed",
      "refunded",
      "disputed",
    ],
    actions: ["refund"],
    paginated: true,
  },
  payouts: {
    title: "Provider payouts",
    description:
      "Track verified transfers. Retry eligible failed payouts without creating a second transfer reference.",
    query: "payouts",
    detail: "payout",
    roles: finance,
    columns: ["amountMinor", "status", "gatewayStatus", "createdAt"],
    statuses: ["pending", "processing", "succeeded", "failed", "cancelled"],
    actions: ["retryPayout"],
    paginated: true,
  },
  reconciliations: {
    title: "Reconciliation",
    description:
      "Compare recorded payments, payouts and refunds with Paystack evidence. Maximum 31 days and 1,000 records per run. This operation never starts a money transfer.",
    query: "reconciliations",
    detail: "reconciliation",
    roles: finance,
    columns: [
      "status",
      "total",
      "checked",
      "skipped",
      "mismatchCount",
      "createdAt",
    ],
    statuses: [
      "queued",
      "running",
      "completed",
      "completed_with_errors",
      "failed",
    ],
    create: "reconcile",
    paginated: true,
  },
  universities: {
    title: "Universities & campuses",
    description:
      "Maintain universities, campuses and approved email domains. Inactive entries cannot be selected for new accounts.",
    query: "universities",
    detail: "university",
    roles: admin,
    columns: ["name", "shortName", "city", "state", "isActive"],
    statuses: ["active", "inactive"],
    create: "createUniversity",
    actions: ["updateUniversity"],
    paginated: true,
  },
  categories: {
    title: "Service categories",
    description: "Maintain the categories used to organise provider services.",
    query: "categories",
    roles: admin,
    columns: ["name", "slug", "parentId", "isActive"],
    statuses: ["active", "inactive"],
    create: "createCategory",
    actions: ["updateCategory"],
    paginated: true,
  },
  "audit-events": {
    title: "Audit trail",
    description:
      "Read recorded staff decisions and sensitive account actions. Audit entries cannot be edited from the dashboard.",
    query: "auditEvents",
    roles: admin,
    columns: ["action", "actorId", "resourceType", "reason", "createdAt"],
    paginated: true,
  },
};
export const labels: Record<string, string> = {
  fullName: "Full name",
  email: "Email",
  accountStatus: "Account status",
  studentVerificationStatus: "Student verification",
  userId: "Account",
  providerId: "Provider",
  jobId: "Job",
  amountMinor: "Amount",
  platformFeeMinor: "Commission",
  providerAmountMinor: "Provider share",
  gatewayFeeMinor: "Collection fee",
  gatewayStatus: "Gateway status",
  createdAt: "Created",
  submittedAt: "Submitted",
  updatedAt: "Updated",
  reviewStatus: "Approval status",
  professionalTitle: "Professional title",
  isActive: "Active",
  shortName: "Short name",
  parentId: "Parent category",
  mismatchCount: "Errors / mismatches",
  actorId: "Operator",
  resourceType: "Resource",
  resourceId: "Record",
  reviewRevision: "Submission version",
  uploadId: "Evidence document",
  retainUntil: "Retained until",
  accountNumberLast4: "Account ending",
  bankCode: "Bank",
  expiresAt: "Expires",
  openedByUserId: "Opened by",
  evidenceObjectKey: "Evidence reference",
  checked: "Verified records",
  skipped: "Skipped records",
  collectedMinor: "Verified collections",
  paidOutMinor: "Confirmed provider payouts",
  refundedMinor: "Confirmed refunds",
  earnedCommissionMinor: "Earned commission",
  reservedClientFundsMinor: "Reserved client funds",
  knownProcessingFeesMinor: "Known collection fees",
  missingProcessingFeeCount: "Payments with unknown fees",
};
export const label = (key: string) =>
  labels[key] ??
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
export const text = (value: unknown) =>
  typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : typeof value === "boolean"
        ? value
          ? "Yes"
          : "No"
        : "—";
export const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(record) : [];
export function display(key: string, value: unknown) {
  if (value === null || value === undefined) return "—";
  if (key.endsWith("Minor") && typeof value === "number")
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
    }).format(value / 100);
  if (
    typeof value === "string" &&
    (key.endsWith("At") || key === "from" || key === "to" || key === "asOf")
  ) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date.toLocaleString("en-NG");
  }
  return text(value);
}
