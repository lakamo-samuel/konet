import assert from "node:assert/strict";
export function hiringFixture(providerId, ownerId, isPublished) {
  const requests = [];
  const quotes = [];
  const jobs = [];
  const milestones = new Map();
  let serial = 40;
  const id = () =>
    `00000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`;
  const owns = (row, user) =>
    row &&
    (row.clientId === user.id ||
      (row.providerId === providerId && user.id === ownerId));
  return {
    fund: (jobId) => {
      jobs.find((j) => j.id === jobId).status = "scheduled";
    },
    handle(url, method, body, user, send) {
      if (
        !["/api/v1/requests", "/api/v1/quotes", "/api/v1/jobs"].some((p) =>
          url.pathname.startsWith(p),
        )
      )
        return false;
      const reply = (status, data) => {
        send(status, data);
        return true;
      };
      if (!user)
        return reply(401, {
          code: "SESSION_REQUIRED",
          message: "Sign in first.",
        });
      const path = url.pathname.split("/");
      const collection = path[3];
      const resourceId = path[4];
      const action = path[5];
      if (collection === "requests") {
        if (!resourceId && method === "POST") {
          assert.ok(body.description.length >= 20);
          assert.equal(body.details, undefined);
          assert.equal(body.budgetMin, undefined);
          if (user.id === ownerId)
            return reply(422, {
              code: "SELF_HIRING_FORBIDDEN",
              message: "You cannot hire yourself.",
            });
          if (user.studentVerificationStatus !== "verified" || !isPublished())
            return reply(422, {
              code: "HIRING_INELIGIBLE",
              message: "A verified client and published provider are required.",
            });
          const record = {
            id: id(),
            clientId: user.id,
            providerId: body.providerId,
            serviceId: body.serviceId,
            ...body,
            budgetMinMinor: body.budgetMinMinor ?? null,
            budgetMaxMinor: body.budgetMaxMinor ?? null,
            currency: "NGN",
            requestedAt: body.requestedAt ?? null,
            location: body.location ?? null,
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          requests.push(record);
          return reply(201, record);
        }
        if (!resourceId)
          return reply(
            200,
            requests
              .filter((r) => owns(r, user))
              .slice(
                Number(url.searchParams.get("offset") ?? 0),
                Number(url.searchParams.get("offset") ?? 0) +
                  Number(url.searchParams.get("limit") ?? 20),
              ),
          );
        const row = requests.find((r) => r.id === resourceId);
        if (!owns(row, user))
          return reply(404, {
            code: "REQUEST_NOT_FOUND",
            message: "Request not found.",
          });
        if (action === "quotes")
          return reply(
            200,
            quotes.filter((q) => q.requestId === row.id),
          );
        if (action) {
          if (
            (action === "withdraw" && row.clientId !== user.id) ||
            (action === "decline" && user.id !== ownerId)
          )
            return reply(403, {
              code: "REQUEST_ACTION_FORBIDDEN",
              message: "Action not allowed.",
            });
          assert.deepEqual(Object.keys(body), ["reason"]);
          row.status = action === "withdraw" ? "withdrawn" : "declined";
          return reply(200, row);
        }
        return reply(200, row);
      }
      if (collection === "quotes") {
        if (!resourceId && method === "POST") {
          const request = requests.find((r) => r.id === body.requestId);
          if (!owns(request, user))
            return reply(404, {
              code: "REQUEST_NOT_FOUND",
              message: "Request not found.",
            });
          if (user.id !== ownerId)
            return reply(403, {
              code: "QUOTE_ACTION_FORBIDDEN",
              message: "Only the provider can quote.",
            });
          assert.equal(body.amount, undefined);
          assert.ok(Number.isInteger(body.amountMinor));
          assert.ok(Date.parse(body.expiresAt) > Date.now());
          const quote = {
            id: id(),
            ...body,
            providerId,
            clientId: request.clientId,
            currency: "NGN",
            status: "sent",
            deliveryAt: body.deliveryAt ?? null,
            notes: body.notes ?? null,
          };
          quotes.push(quote);
          request.status = "quoted";
          return reply(201, quote);
        }
        const row = quotes.find((q) => q.id === resourceId);
        if (!owns(row, user))
          return reply(404, {
            code: "QUOTE_NOT_FOUND",
            message: "Quote not found.",
          });
        if (action === "accept") {
          if (user.id !== row.clientId)
            return reply(403, {
              code: "QUOTE_ACTION_FORBIDDEN",
              message: "Only the client can accept.",
            });
          const existing = jobs.find((j) => j.quoteId === row.id);
          if (existing) return reply(201, existing);
          if (row.status !== "sent" || Date.parse(row.expiresAt) <= Date.now())
            return reply(409, {
              code: "QUOTE_UNAVAILABLE",
              message: "Quote is unavailable.",
            });
          const request = requests.find((r) => r.id === row.requestId);
          row.status = "accepted";
          request.status = "converted_to_job";
          const job = {
            id: id(),
            requestId: request.id,
            quoteId: row.id,
            clientId: row.clientId,
            providerId,
            serviceId: request.serviceId,
            agreedAmountMinor: row.amountMinor,
            currency: "NGN",
            status: "awaiting_payment",
            scheduledAt: null,
            startedAt: null,
            providerCompletedAt: null,
            clientConfirmedAt: null,
            completedAt: null,
          };
          jobs.push(job);
          return reply(201, job);
        }
        if (action) {
          if (
            (action === "decline" && user.id !== row.clientId) ||
            (action === "cancel" && user.id !== ownerId)
          )
            return reply(403, {
              code: "QUOTE_ACTION_FORBIDDEN",
              message: "Action not allowed.",
            });
          row.status = action === "decline" ? "declined" : "cancelled";
          return reply(200, row);
        }
        return reply(200, row);
      }
      if (!resourceId)
        return reply(
          200,
          jobs.filter((j) => owns(j, user)),
        );
      const job = jobs.find((j) => j.id === resourceId);
      if (!owns(job, user))
        return reply(404, { code: "JOB_NOT_FOUND", message: "Job not found." });
      if (action === "milestones") {
        const rows = milestones.get(job.id) ?? [];
        if (method === "GET") return reply(200, rows);
        if (user.id !== ownerId)
          return reply(403, {
            code: "MILESTONE_FORBIDDEN",
            message: "Only the provider manages milestones.",
          });
        if (method === "POST") {
          const row = {
            id: id(),
            title: body.title,
            description: body.description ?? null,
            dueAt: body.dueAt ?? null,
            status: "pending",
          };
          rows.push(row);
          milestones.set(job.id, rows);
          return reply(201, row);
        }
        const row = rows.find((m) => m.id === path[6]);
        Object.assign(row, body);
        return reply(200, row);
      }
      if (action === "cancel") {
        if (job.status !== "awaiting_payment")
          return reply(409, {
            code: "CANCELLATION_REQUIRES_REFUND",
            message: "A funded job cannot be cancelled here.",
          });
        job.status = "cancelled";
        return reply(200, job);
      }
      if (action) {
        const required =
          action === "start"
            ? "scheduled"
            : action === "mark-complete"
              ? "in_progress"
              : "awaiting_client_confirmation";
        const provider = action !== "confirm-completion";
        if (
          (provider && user.id !== ownerId) ||
          (!provider && user.id !== job.clientId)
        )
          return reply(403, {
            code: "JOB_ACTION_FORBIDDEN",
            message: "Wrong participant action.",
          });
        if (job.status !== required)
          return reply(409, {
            code: "INVALID_JOB_STATE",
            message: "Job is not ready for this action.",
          });
        if (
          action === "mark-complete" &&
          (milestones.get(job.id) ?? []).some((m) => m.status !== "completed")
        )
          return reply(409, {
            code: "MILESTONES_INCOMPLETE",
            message: "Complete the milestones first.",
          });
        job.status =
          action === "start"
            ? "in_progress"
            : action === "mark-complete"
              ? "awaiting_client_confirmation"
              : "completed";
        return reply(200, job);
      }
      return reply(200, job);
    },
  };
}
