import { DataError } from "@/data/access/errors";
export const staffRoles = ["admin", "reviewer", "finance", "support"] as const;
export type StaffRole = (typeof staffRoles)[number];
export const isStaff = (roles: readonly string[]) =>
  roles.some((role) => staffRoles.some((staff) => staff === role));
export type AdminRecord = Record<string, unknown>;
export type AdminResponse = AdminRecord | AdminRecord[] | undefined;
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "boolean"
    | "select"
    | "datetime-local"
    | "password";
  options?: readonly string[];
  required?: boolean;
  min?: number;
  max?: number;
  initial?: string | number | boolean;
  readOnly?: boolean;
  nullable?: boolean;
};
export type Params = { id?: string; universityId?: string; role?: string };
const reviewRoles: StaffRole[] = ["admin", "reviewer"];
const financeRoles: StaffRole[] = ["admin", "finance"];
const adminRoles: StaffRole[] = ["admin"];
const query = (path: string, roles: StaffRole[]) => ({ path, roles });
export const adminQueries = {
  security: query("/me/staff-security", [...staffRoles]),
  users: query("/admin/users", adminRoles),
  user: query("/admin/users/:id", adminRoles),
  studentVerifications: query("/admin/student-verifications", reviewRoles),
  studentVerification: query("/admin/student-verifications/:id", reviewRoles),
  providerVerifications: query("/admin/provider-verifications", reviewRoles),
  providerVerification: query("/admin/provider-verifications/:id", reviewRoles),
  providers: query("/admin/providers", reviewRoles),
  provider: query("/admin/providers/:id", reviewRoles),
  disputes: query("/admin/disputes", financeRoles),
  dispute: query("/admin/disputes/:id", financeRoles),
  payments: query("/admin/payments", financeRoles),
  payment: query("/admin/payments/:id", financeRoles),
  payouts: query("/admin/payouts", financeRoles),
  payout: query("/admin/payouts/:id", financeRoles),
  reconciliations: query("/admin/reconciliations", financeRoles),
  reconciliation: query("/admin/reconciliations/:id", financeRoles),
  reports: query("/admin/reports", financeRoles),
  universities: query("/admin/universities", adminRoles),
  university: query("/admin/universities/:id", adminRoles),
  campuses: query("/admin/universities/:universityId/campuses", adminRoles),
  domains: query("/admin/universities/:universityId/email-domains", adminRoles),
  categories: query("/admin/categories", adminRoles),
  auditEvents: query("/admin/audit-events", adminRoles),
  evidence: query("/uploads/:id/download", reviewRoles),
} as const;
export type AdminQuery = keyof typeof adminQueries;
export type AdminQueryInput = {
  operation: AdminQuery;
  params?: Params;
  filters?: {
    status?: string;
    email?: string;
    limit?: number;
    offset?: number;
  };
};
const reason: Field = {
  name: "reason",
  label: "Reason for this action",
  type: "textarea",
  required: true,
  min: 3,
  max: 2000,
};
const decision: Field = {
  name: "decision",
  label: "Decision",
  type: "select",
  options: ["verified", "rejected", "requires_more_information"],
  required: true,
};
const revision: Field = {
  name: "revision",
  label: "Submission version",
  type: "number",
  min: 1,
  required: true,
  readOnly: true,
};
const name: Field = {
  name: "name",
  label: "Name",
  min: 2,
  max: 150,
  required: true,
};
const slug: Field = {
  name: "slug",
  label: "URL name",
  min: 2,
  max: 100,
  required: true,
};
const active: Field = {
  name: "isActive",
  label: "Active",
  type: "boolean",
  initial: true,
};
const universityFields: Field[] = [
  { ...name, max: 255 },
  { name: "shortName", label: "Short name", min: 2, max: 50, required: true },
  slug,
  { name: "city", label: "City", min: 2, max: 100, required: true },
  { name: "state", label: "State", min: 2, max: 100, required: true },
  { name: "country", label: "Country", initial: "Nigeria", min: 2, max: 100 },
  active,
];
const domainFields: Field[] = [
  {
    name: "domain",
    label: "University email domain",
    min: 3,
    max: 255,
    required: true,
  },
  {
    name: "approved",
    label: "Allow automatic student verification for this domain",
    type: "boolean",
    initial: false,
  },
];
const categoryFields: Field[] = [
  { ...name, max: 120 },
  { ...slug, max: 120 },
  {
    name: "parentId",
    label: "Parent category ID (leave empty for a root category)",
    max: 36,
    nullable: true,
  },
  active,
];
const action = (
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  label: string,
  roles: StaffRole[],
  fields: Field[],
  confirm = false,
) => ({ path, method, label, roles, fields, confirm });
export const adminCommands = {
  enrollMfa: action(
    "/me/staff-security/enrollment",
    "POST",
    "Set up authenticator",
    [...staffRoles],
    [
      {
        name: "password",
        label: "Current password",
        type: "password",
        required: true,
        max: 128,
      },
    ],
  ),
  confirmMfa: action(
    "/me/staff-security/confirm",
    "POST",
    "Confirm authenticator",
    [...staffRoles],
    [
      {
        name: "code",
        label: "Authenticator code",
        required: true,
        min: 6,
        max: 6,
      },
    ],
  ),
  verifyMfa: action(
    "/me/staff-security/verify",
    "POST",
    "Verify staff access",
    [...staffRoles],
    [
      {
        name: "code",
        label: "Authenticator or recovery code",
        required: true,
        min: 6,
        max: 64,
      },
    ],
  ),
  accountStatus: action(
    "/admin/users/:id/status",
    "PATCH",
    "Change account status",
    adminRoles,
    [
      {
        name: "status",
        label: "Account status",
        type: "select",
        options: ["active", "suspended", "deactivated"],
        required: true,
      },
      reason,
    ],
    true,
  ),
  grantRole: action(
    "/admin/users/:id/roles",
    "POST",
    "Grant staff role",
    adminRoles,
    [
      {
        name: "role",
        label: "Staff role",
        type: "select",
        options: staffRoles,
        required: true,
      },
      reason,
    ],
    true,
  ),
  revokeRole: action(
    "/admin/users/:id/roles/:role",
    "DELETE",
    "Remove staff role",
    adminRoles,
    [reason],
    true,
  ),
  studentDecision: action(
    "/admin/student-verifications/:id/decision",
    "POST",
    "Record student decision",
    reviewRoles,
    [decision, reason],
    true,
  ),
  evidenceDecision: action(
    "/admin/provider-verifications/:id/decision",
    "POST",
    "Record evidence decision",
    reviewRoles,
    [revision, decision, reason],
    true,
  ),
  providerDecision: action(
    "/admin/providers/:id/decision",
    "POST",
    "Record provider decision",
    reviewRoles,
    [
      revision,
      {
        ...decision,
        options: ["active", "rejected", "requires_more_information"],
      },
      reason,
    ],
    true,
  ),
  disputeDecision: action(
    "/admin/disputes/:id/decision",
    "POST",
    "Resolve dispute",
    financeRoles,
    [
      {
        ...decision,
        options: ["resolved_for_client", "resolved_for_provider"],
      },
      reason,
    ],
    true,
  ),
  refund: action(
    "/admin/payments/:id/refunds",
    "POST",
    "Queue full refund",
    financeRoles,
    [
      {
        name: "amountMinor",
        label: "Full refund amount (kobo)",
        type: "number",
        min: 1,
        max: 2147483647,
        required: true,
        readOnly: true,
      },
      reason,
    ],
    true,
  ),
  retryPayout: action(
    "/admin/payouts/:id/retry",
    "POST",
    "Retry payout",
    financeRoles,
    [reason],
    true,
  ),
  reconcile: action(
    "/admin/reconciliations",
    "POST",
    "Start reconciliation",
    financeRoles,
    [
      {
        name: "from",
        label: "Start (inclusive)",
        type: "datetime-local",
        required: true,
      },
      {
        name: "to",
        label: "End (exclusive)",
        type: "datetime-local",
        required: true,
      },
    ],
    true,
  ),
  createUniversity: action(
    "/admin/universities",
    "POST",
    "Create university",
    adminRoles,
    universityFields,
  ),
  updateUniversity: action(
    "/admin/universities/:id",
    "PATCH",
    "Save university",
    adminRoles,
    universityFields,
  ),
  createCampus: action(
    "/admin/universities/:universityId/campuses",
    "POST",
    "Create campus",
    adminRoles,
    [name, slug, active],
  ),
  updateCampus: action(
    "/admin/universities/:universityId/campuses/:id",
    "PATCH",
    "Save campus",
    adminRoles,
    [name, slug, active],
  ),
  archiveCampus: action(
    "/admin/universities/:universityId/campuses/:id",
    "DELETE",
    "Archive campus",
    adminRoles,
    [],
    true,
  ),
  createDomain: action(
    "/admin/universities/:universityId/email-domains",
    "POST",
    "Add email domain",
    adminRoles,
    domainFields,
  ),
  updateDomain: action(
    "/admin/universities/:universityId/email-domains/:id",
    "PATCH",
    "Save email domain",
    adminRoles,
    domainFields,
  ),
  deleteDomain: action(
    "/admin/universities/:universityId/email-domains/:id",
    "DELETE",
    "Remove email domain",
    adminRoles,
    [],
    true,
  ),
  createCategory: action(
    "/admin/categories",
    "POST",
    "Create category",
    adminRoles,
    categoryFields,
  ),
  updateCategory: action(
    "/admin/categories/:id",
    "PATCH",
    "Save category",
    adminRoles,
    categoryFields,
  ),
} as const;
export type AdminCommand = keyof typeof adminCommands;
export type AdminCommandInput = {
  operation: AdminCommand;
  params?: Params;
  values: AdminRecord;
};
export const canAccess = (
  roles: readonly string[],
  allowed: readonly string[],
) => roles.some((role) => allowed.includes(role));
export function operationPath(template: string, params: Params = {}) {
  return template.replace(/:(\w+)/g, (_, key: keyof Params) => {
    const value = params[key];
    if (
      !value ||
      (key === "role"
        ? !staffRoles.some((role) => role === value)
        : !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
            value,
          ))
    )
      throw new DataError("Choose a valid record.");
    return encodeURIComponent(value);
  });
}
export function validateAdminInput(kind: "query" | "command", input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new DataError("Invalid staff request.");
  const data = input as AdminRecord;
  const registry = kind === "query" ? adminQueries : adminCommands;
  if (
    typeof data.operation !== "string" ||
    !Object.hasOwn(registry, data.operation)
  )
    throw new DataError("Unknown staff operation.");
  const definition =
    kind === "query"
      ? adminQueries[data.operation as AdminQuery]
      : adminCommands[data.operation as AdminCommand];
  if (
    data.params !== undefined &&
    (!data.params ||
      typeof data.params !== "object" ||
      Array.isArray(data.params))
  )
    throw new DataError("Invalid record selection.");
  operationPath(definition.path, data.params as Params | undefined);
  if (kind === "query") {
    const filters = (data.filters ?? {}) as AdminRecord;
    if (!filters || typeof filters !== "object" || Array.isArray(filters))
      throw new DataError("Invalid filters.");
    for (const [key, value] of Object.entries(filters)) {
      if (!["status", "email", "limit", "offset"].includes(key))
        throw new DataError("Unsupported filter.");
      if (
        ["limit", "offset"].includes(key)
          ? !Number.isInteger(value) ||
            Number(value) < (key === "limit" ? 1 : 0) ||
            Number(value) > (key === "limit" ? 100 : 1000000)
          : typeof value !== "string" || value.length > 255
      )
        throw new DataError("Invalid filter.");
    }
    return;
  }
  const fields = adminCommands[data.operation as AdminCommand].fields;
  if (
    !data.values ||
    typeof data.values !== "object" ||
    Array.isArray(data.values)
  )
    throw new DataError("Invalid action fields.");
  for (const [key, value] of Object.entries(data.values as AdminRecord)) {
    const field = fields.find((item) => item.name === key);
    if (!field) throw new DataError("Unsupported action field.");
    if (value === null && field.nullable) continue;
    if (field.type === "boolean") {
      if (typeof value !== "boolean")
        throw new DataError(`Choose ${field.label}.`);
    } else if (field.type === "number") {
      if (
        !Number.isSafeInteger(value) ||
        Number(value) < (field.min ?? 0) ||
        Number(value) > (field.max ?? 2147483647)
      )
        throw new DataError(`Enter a valid ${field.label.toLowerCase()}.`);
    } else if (
      typeof value !== "string" ||
      value.trim().length < (field.min ?? (field.required ? 1 : 0)) ||
      value.length > (field.max ?? 2000) ||
      (field.options && !field.options.includes(value))
    )
      throw new DataError(`Enter a valid ${field.label.toLowerCase()}.`);
  }
  for (const field of fields)
    if (field.required && !Object.hasOwn(data.values, field.name))
      throw new DataError(`${field.label} is required.`);
}
