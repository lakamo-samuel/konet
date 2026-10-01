import type {
  OpenAPIObject,
  OperationObject,
  ResponseObject,
  SchemaObject,
} from "@nestjs/swagger";
import { contractSchemas, routeContracts } from "./contract-registry";

const jsonContent = (schema: SchemaObject | { $ref: string }) => ({
  "application/json": { schema },
});
const errorContent = jsonContent({ $ref: "#/components/schemas/Error" });

/** Enrich actual Nest routes; fail document generation if any declared route is missing. */
export function applyRouteContracts(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {};
  document.components.schemas = {
    ...document.components.schemas,
    ...contractSchemas,
  };
  document.components.securitySchemes = {
    ...document.components.securitySchemes,
    refreshCookie: { type: "apiKey", in: "cookie", name: "konet_refresh" },
  };
  const documented = new Set<string>();
  for (const route of routeContracts) {
    const path = `/api/v1/${route.path}`;
    const operation = document.paths[path]?.[route.method as "get"] as
      OperationObject | undefined;
    if (!operation)
      throw new Error(
        `Contract has no registered Nest route: ${route.method.toUpperCase()} ${path}`,
      );
    documented.add(`${route.method} ${path}`);
    const gatewayBlocked = route.path === "jobs/{jobId}/payments";
    const status = !route.existing
      ? "contract-only"
      : gatewayBlocked
        ? "gateway-unconfigured"
        : "implemented";
    (operation as OperationObject & { "x-implementation-status": string })[
      "x-implementation-status"
    ] = status;
    operation.operationId = `${route.method}_${route.path.replace(/[{}]/g, "").replace(/[/-]/g, "_")}`;
    operation.summary = `${route.summary}${!route.existing ? " [contract only]" : ""}`;
    const access =
      route.auth === "reviewer"
        ? "Requires an active admin or reviewer role, in addition to a live Bearer session. Document access and decisions are audited; self-review is forbidden."
        : route.auth === "admin"
          ? route.existing
            ? "Requires an active administrator role from the database, in addition to a live Bearer session. Reviewer, support, finance, and ordinary student accounts cannot manage the directory or read the audit log."
            : "Requires a staff role with permission for this resource. This stub always fails closed; its resource-specific permission enforcement remains pending."
          : route.auth === "user"
            ? "Requires a valid Bearer access token and resource ownership where applicable."
            : route.auth === "cookie"
              ? "Uses the HttpOnly konet_refresh cookie; send requests with credentials included."
              : route.auth === "webhook"
                ? "Payment provider callback only; signature verification will replace browser authentication."
                : "Public endpoint; no authentication required.";
    operation.description = [
      access,
      !route.existing
        ? "NOT IMPLEMENTED: valid requests currently return 501 ENDPOINT_NOT_IMPLEMENTED. The success response below is the agreed target contract for frontend integration and mocks."
        : "Existing backend handler is retained. Implementation status describes handler availability, not completion of every product acceptance rule.",
      route.note,
      "Money uses integer minor units (NGN kobo: 100 kobo = ₦1). Dates use ISO 8601 with timezone; response timestamps are UTC. Lists return arrays, not pagination envelopes.",
    ]
      .filter(Boolean)
      .join("\n\n");
    operation.security =
      route.auth === "public" || route.auth === "webhook"
        ? []
        : route.auth === "cookie"
          ? [{ refreshCookie: [] }]
          : [{ bearer: [] }];
    operation.tags = [
      route.auth === "admin" || route.auth === "reviewer"
        ? "administration"
        : route.auth === "webhook"
          ? "payment webhooks"
          : route.path.startsWith("auth/")
            ? "auth"
            : route.path.split("/")[0] === "me"
              ? route.path.split("/")[1]
              : route.path.split("/")[0],
    ];
    operation.parameters = [];
    for (const match of route.path.matchAll(/\{(\w+)\}/g)) {
      const name = match[1];
      operation.parameters.push({
        name,
        in: "path",
        required: true,
        description:
          name === "gateway"
            ? "Selected payment provider identifier; provider selection is pending."
            : name === "step"
              ? "Onboarding section: profile, services, portfolio, evidence, or preview."
              : name === "role"
                ? "Staff role to revoke."
                : "Resource UUID.",
        schema: {
          type: "string",
          ...(name === "step"
            ? {
                enum: [
                  "profile",
                  "services",
                  "portfolio",
                  "evidence",
                  "preview",
                ],
              }
            : name === "role"
              ? { enum: ["admin", "reviewer", "support", "finance"] }
              : name === "gateway"
                ? {}
                : { format: "uuid" }),
        },
      });
    }
    if (route.query) {
      for (const [name, schema] of Object.entries(
        contractSchemas[route.query].properties ?? {},
      )) {
        operation.parameters.push({
          name,
          in: "query",
          required: false,
          schema,
        });
      }
    }
    if (route.auth === "webhook") {
      operation.parameters.push({
        name: "X-Payment-Signature",
        in: "header",
        required: true,
        description:
          "Placeholder name: final header and signing algorithm depend on the selected provider. Do not integrate against this header until provider selection.",
        schema: { type: "string" },
      });
      operation.requestBody = {
        required: true,
        description:
          "Unmodified provider JSON event. Exact event schema and signature header are intentionally provider-dependent.",
        content: jsonContent({ type: "object", additionalProperties: true }),
      };
    } else if (route.body) {
      operation.requestBody = {
        required: true,
        content: jsonContent({ $ref: `#/components/schemas/${route.body}` }),
      };
    } else {
      delete operation.requestBody;
    }
    const responseSchema = route.response.endsWith("[]")
      ? {
          type: "array" as const,
          items: {
            $ref: `#/components/schemas/${route.response.slice(0, -2)}`,
          },
        }
      : { $ref: `#/components/schemas/${route.response}` };
    operation.responses = {
      [route.code]: {
        description: `${route.existing ? "Current" : "Planned"} successful response.${route.code === 204 ? " No response body." : ""}`,
        ...(route.code === 204 ? {} : { content: jsonContent(responseSchema) }),
      },
      400: {
        description: "Invalid request fields, types, or format.",
        content: errorContent,
      },
      404: {
        description: "Resource not found or unavailable.",
        content: errorContent,
      },
      409: {
        description:
          "Duplicate action, expired resource, or conflicting state.",
        content: errorContent,
      },
      422: {
        description: "Business-rule validation failed.",
        content: errorContent,
      },
      429: { description: "Rate limit exceeded.", content: errorContent },
      500: { description: "Unexpected server error.", content: errorContent },
    };
    if (route.auth !== "public" && route.auth !== "webhook") {
      operation.responses[401] = {
        description: "Missing, invalid, or expired authentication.",
        content: errorContent,
      };
      operation.responses[403] = {
        description:
          "Wrong participant, unverified student, unapproved provider, or insufficient staff permission.",
        content: errorContent,
      };
    }
    if (
      route.path.startsWith("uploads") ||
      route.path === "me/student-verification/email-challenges"
    ) {
      operation.responses[503] = {
        description:
          "Required storage, malware moderation, or email service is unconfigured or unavailable.",
        content: errorContent,
      };
    }
    if (route.path === "uploads/presign")
      operation.responses[501] = {
        description:
          "UPLOAD_PURPOSE_NOT_IMPLEMENTED: currently student_evidence only.",
        content: errorContent,
      };
    if (!route.existing)
      operation.responses[501] = {
        description:
          "Current response: ENDPOINT_NOT_IMPLEMENTED. No data or money is changed.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: {
              statusCode: 501,
              code: "ENDPOINT_NOT_IMPLEMENTED",
              message: `${route.summary} is contract-only; backend implementation is pending.`,
              path,
            },
          },
        },
      };
    if (
      gatewayBlocked ||
      route.path === "health" ||
      route.path === "auth/forgot-password"
    )
      operation.responses[503] = {
        description: gatewayBlocked
          ? "PAYMENT_GATEWAY_NOT_CONFIGURED: real checkout is unavailable."
          : route.path === "auth/forgot-password"
            ? "EMAIL_DELIVERY_NOT_CONFIGURED: set Resend credentials, sender address, and outbox encryption key."
            : "Database unavailable.",
        content:
          gatewayBlocked || route.path === "auth/forgot-password"
            ? errorContent
            : jsonContent({
                type: "object",
                properties: {
                  status: { type: "string", enum: ["error"] },
                  database: { type: "string", enum: ["down"] },
                },
              }),
      };
    if (
      route.path === "auth/register" ||
      route.path === "auth/login" ||
      route.path === "auth/refresh"
    ) {
      (operation.responses![route.code] as ResponseObject).headers = {
        "Set-Cookie": {
          description:
            "Sets HttpOnly konet_refresh cookie scoped to /api/v1/auth; Secure in production; SameSite=Lax.",
          schema: { type: "string" },
        },
      };
    }
  }
  for (const [path, methods] of Object.entries(document.paths)) {
    for (const method of Object.keys(methods)) {
      if (
        ["get", "post", "patch", "put", "delete"].includes(method) &&
        !documented.has(`${method} ${path}`)
      )
        throw new Error(
          `Registered route is missing a contract: ${method} ${path}`,
        );
    }
  }
  return document;
}
