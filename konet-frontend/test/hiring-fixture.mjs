import assert from "node:assert/strict";
export function hiringFixture(providerId, ownerId, isPublished) {
  const requests = [];
  const quotes = [];
  const jobs = [];
  const milestones = new Map();
  const payments = [];
  const payouts = [];
  const accounts = [];
  const conversations = [];
  const messages = [];
  let gatewayAvailable = true;
  let verificationSuccess = false;
  let serial = 40;
  const id = () =>
    `00000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`;
  const owns = (row, user) =>
    row &&
    (row.clientId === user.id ||
      (row.providerId === providerId && user.id === ownerId));
  return {
    gatewayAvailable: (value) => {
      gatewayAvailable = value;
    },
    verificationSuccess: (value) => {
      verificationSuccess = value;
    },
    handle(url, method, body, user, send) {
      if (
        ![
          "/api/v1/conversations",
          "/api/v1/requests",
          "/api/v1/quotes",
          "/api/v1/jobs",
          "/api/v1/me/payments",
          "/api/v1/me/earnings",
          "/api/v1/me/payouts",
          "/api/v1/me/payout-accounts",
          "/api/v1/payout-banks",
        ].some((p) => url.pathname.startsWith(p))
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
      const page = (rows) =>
        rows.slice(
          Number(url.searchParams.get("offset") ?? 0),
          Number(url.searchParams.get("offset") ?? 0) +
            Number(url.searchParams.get("limit") ?? 20),
        );
      if (url.pathname.startsWith("/api/v1/conversations")) {
        const parts = url.pathname.split("/");
        const conversation = conversations.find((c) => c.id === parts[4]);
        if (!parts[4])
          return reply(
            200,
            page(
              conversations.filter((c) => c.participantIds.includes(user.id)),
            ),
          );
        if (!conversation?.participantIds.includes(user.id))
          return reply(404, {
            code: "CONVERSATION_NOT_FOUND",
            message: "Conversation not found.",
          });
        if (parts[5] === "read")
          return reply(200, {
            message: "Conversation marked read.",
            readAt: new Date().toISOString(),
          });
        if (parts[5] === "messages") {
          if (method === "GET")
            return reply(
              200,
              page(
                messages.filter((m) => m.conversationId === conversation.id),
              ),
            );
          assert.equal(body.body, undefined);
          assert.equal(body.senderId, undefined);
          if (!body.content.trim() || body.content.length > 10000)
            return reply(422, {
              code: "INVALID_MESSAGE",
              message: "Invalid message.",
            });
          const message = {
            id: id(),
            conversationId: conversation.id,
            senderId: user.id,
            content: body.content,
            type: "text",
            createdAt: new Date().toISOString(),
          };
          messages.push(message);
          return reply(201, message);
        }
        return reply(200, conversation);
      }
      if (url.pathname === "/api/v1/payout-banks")
        return gatewayAvailable
          ? reply(200, [{ code: "058", name: "Test Bank" }])
          : reply(503, {
              code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
              message: "Gateway is not configured.",
            });
      if (url.pathname === "/api/v1/me/payments")
        return reply(
          200,
          page(
            payments.filter((p) => owns({ ...p, clientId: p.payerId }, user)),
          ),
        );
      if (url.pathname.startsWith("/api/v1/me/")) {
        if (user.id !== ownerId)
          return reply(403, {
            code: "PROVIDER_REQUIRED",
            message: "Provider profile required.",
          });
        if (url.pathname === "/api/v1/me/payouts")
          return reply(200, page(payouts));
        if (url.pathname === "/api/v1/me/earnings") {
          const completed = payments.filter(
            (p) => jobs.find((j) => j.id === p.jobId)?.status === "completed",
          );
          return reply(200, {
            currency: "NGN",
            earnedMinor: completed.reduce(
              (n, p) => n + p.providerAmountMinor,
              0,
            ),
            pendingMinor: completed
              .filter((p) => p.status === "release_pending")
              .reduce((n, p) => n + p.providerAmountMinor, 0),
            paidOutMinor: completed
              .filter((p) => p.status === "released")
              .reduce((n, p) => n + p.providerAmountMinor, 0),
          });
        }
        if (url.pathname === "/api/v1/me/payout-accounts") {
          if (method === "GET") return reply(200, accounts);
          if (!gatewayAvailable)
            return reply(503, {
              code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
              message: "Gateway is not configured.",
            });
          assert.equal(body.accountNumber, "0123456789");
          assert.equal(body.bankCode, "058");
          if (accounts.length)
            return reply(409, {
              code: "PAYOUT_ACCOUNT_EXISTS",
              message: "Remove the existing account first.",
            });
          const account = {
            id: id(),
            providerId,
            bankCode: body.bankCode,
            accountName: "Test Provider",
            accountNumberLast4: "6789",
            status: "verified",
            createdAt: new Date().toISOString(),
          };
          accounts.push(account);
          return reply(201, account);
        }
        if (
          url.pathname.startsWith("/api/v1/me/payout-accounts/") &&
          method === "DELETE"
        ) {
          const index = accounts.findIndex(
            (a) => a.id === url.pathname.split("/").at(-1),
          );
          if (index < 0)
            return reply(404, {
              code: "PAYOUT_ACCOUNT_NOT_FOUND",
              message: "Account not found.",
            });
          if (payouts.some((p) => ["pending", "processing"].includes(p.status)))
            return reply(409, {
              code: "PAYOUT_ACCOUNT_RESERVED",
              message: "Account is reserved for a payout.",
            });
          accounts.splice(index, 1);
          return reply(204);
        }
      }
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
          payments.push({
            id: id(),
            jobId: job.id,
            payerId: job.clientId,
            providerId,
            amountMinor: job.agreedAmountMinor,
            platformFeeMinor: 0,
            providerAmountMinor: job.agreedAmountMinor,
            currency: "NGN",
            gateway: "unconfigured",
            gatewayReference: null,
            status: "pending",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          conversations.push({
            id: id(),
            jobId: job.id,
            requestId: request.id,
            participantIds: [job.clientId, ownerId],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
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
      if (action === "conversation")
        return reply(
          200,
          conversations.find((c) => c.jobId === job.id),
        );
      const payment = payments.find((p) => p.jobId === job.id);
      if (action === "payment" || action === "payments") {
        if (method === "GET") return reply(200, payment);
        assert.deepEqual(body, {}); // No browser amount, currency or reference is forwarded.
        if (action === "payments") {
          if (user.id !== job.clientId)
            return reply(403, {
              code: "PAYMENT_FORBIDDEN",
              message: "Only the client initializes payment.",
            });
          if (!gatewayAvailable)
            return reply(503, {
              code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
              message: "Gateway is not configured.",
            });
          if (job.status !== "awaiting_payment")
            return reply(409, {
              code: "INVALID_JOB_STATE",
              message: "Job is not awaiting payment.",
            });
          payment.gatewayReference ??= `konet-${payment.id}`;
          payment.gateway = "paystack";
          payment.status = "processing";
          return reply(201, {
            paymentId: payment.id,
            reference: payment.gatewayReference,
            checkoutUrl: "https://checkout.paystack.com/test-checkout",
          });
        }
        if (!payment.gatewayReference)
          return reply(409, {
            code: "CHECKOUT_REQUIRED",
            message: "Start checkout first.",
          });
        if (!gatewayAvailable)
          return reply(503, {
            code: "PAYMENT_GATEWAY_UNAVAILABLE",
            message: "Gateway unavailable.",
          });
        if (verificationSuccess && payment.status === "processing") {
          payment.status = "funded";
          job.status = "scheduled";
        }
        return reply(200, payment);
      }
      if (action === "payout") {
        const payout = payouts.find((p) => p.jobId === job.id);
        return payout
          ? reply(200, payout)
          : reply(404, {
              code: "PAYOUT_NOT_FOUND",
              message: "Payout is not queued yet.",
            });
      }
      if (action === "refunds") return reply(200, []);
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
        if (action === "confirm-completion") {
          payment.status = "release_pending";
          payouts.push({
            id: id(),
            jobId: job.id,
            paymentId: payment.id,
            amountMinor: payment.providerAmountMinor,
            currency: "NGN",
            status: "pending",
            reference: `payout-${job.id}`,
            createdAt: new Date().toISOString(),
          });
        }
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
