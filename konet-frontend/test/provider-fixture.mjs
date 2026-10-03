import assert from "node:assert/strict";
export function providerFixture(verification) {
  let profile = null;
  const services = [];
  const portfolio = [];
  const evidence = [];
  const steps = {};
  const categoryId = "00000000-0000-4000-8000-000000000020";
  const id = "00000000-0000-4000-8000-000000000021";
  const combined = () => ({
    profile,
    services,
    portfolio,
    verification: evidence,
    steps,
    requirements: {
      requiredDimensions: ["identity", "work"],
      optionalDimensions: ["cac"],
      serviceRequired: true,
    },
    canSubmit:
      !!profile &&
      ["not_submitted", "rejected", "requires_more_information"].includes(
        profile.reviewStatus,
      ) &&
      services.length > 0 &&
      ["identity", "work"].every((d) =>
        evidence.some(
          (e) =>
            e.dimension === d && ["pending", "verified"].includes(e.status),
        ),
      ),
    canPublish: profile?.reviewStatus === "approved" && !!profile.approvedAt,
  });
  return {
    categoryId,
    isPublished: () =>
      profile?.status === "active" && profile?.reviewStatus === "approved",
    approve: () => {
      evidence
        .filter((e) => e.dimension !== "cac")
        .forEach((e) => {
          e.status = "verified";
          e.reason = "Evidence checked.";
        });
      profile.reviewStatus = "approved";
      profile.approvedAt = new Date().toISOString();
      profile.status = "draft";
    },
    requestCorrection: () => {
      evidence[0].status = "requires_more_information";
      evidence[0].reason = "Upload a clearer identity document.";
      profile.reviewStatus = "requires_more_information";
      profile.reviewReason = "Correct identity evidence.";
      profile.status = "draft";
    },
    handle(url, method, body, auth, send) {
      const reply = (status, data) => {
        send(status, data);
        return true;
      };
      if (url.pathname.startsWith(`/api/v1/providers/${id}`)) {
        if (profile?.status !== "active")
          return reply(404, {
            code: "PROVIDER_NOT_FOUND",
            message: "Provider not found.",
          });
        if (url.pathname.endsWith("/portfolio"))
          return reply(
            200,
            portfolio.map((p) => ({ ...p, providerId: id })),
          );
        if (url.pathname.endsWith("/reviews")) return reply(200, []);
        return reply(200, {
          ...profile,
          fullName: "Integration Student",
          universityId: "00000000-0000-4000-8000-000000000002",
          campusName: "Main Campus",
          avatarUrl: null,
          verification: evidence,
          services: services.filter((s) => s.status === "active"),
        });
      }
      if (url.pathname === "/api/v1/categories")
        return reply(200, [{ id: categoryId, name: "Photography" }]);
      if (
        ![
          "/api/v1/me/provider",
          "/api/v1/me/portfolio",
          "/api/v1/me/services",
          "/api/v1/services",
        ].some((p) => url.pathname.startsWith(p))
      )
        return false;
      if (!auth)
        return reply(401, {
          code: "SESSION_REQUIRED",
          message: "Sign in first.",
        });
      if (url.pathname === "/api/v1/me/provider-onboarding")
        return reply(
          200,
          profile?.userId === auth.id
            ? combined()
            : {
                ...combined(),
                profile: null,
                services: [],
                portfolio: [],
                verification: [],
              },
        );
      if (url.pathname === "/api/v1/me/provider-profile" && method === "GET")
        return profile?.userId === auth.id
          ? reply(200, profile)
          : reply(404, {
              code: "PROVIDER_PROFILE_REQUIRED",
              message: "Create a profile first.",
            });
      if (
        url.pathname === "/api/v1/me/provider-verifications" &&
        method === "GET"
      )
        return reply(200, profile?.userId === auth.id ? evidence : []);
      if (method !== "GET" && auth.studentVerificationStatus !== "verified")
        return reply(403, {
          code: "STUDENT_VERIFICATION_REQUIRED",
          message: "Verify your student status first.",
        });
      if (
        profile?.reviewStatus === "pending" &&
        !url.pathname.endsWith("/publish")
      )
        return reply(409, {
          code: "PROVIDER_REVIEW_PENDING",
          message: "Wait for the review decision.",
        });
      if (url.pathname === "/api/v1/me/provider-profile" && method === "POST") {
        assert.equal(body.professionalTitle, "Campus photographer");
        assert.ok(body.bio.length >= 40);
        assert.equal(body.title, undefined);
        if (profile)
          return reply(409, {
            code: "PROVIDER_EXISTS",
            message: "Profile already exists.",
          });
        profile = {
          id,
          userId: auth.id,
          ...body,
          coverImageUrl: null,
          status: "draft",
          availability: "available",
          reviewStatus: "not_submitted",
          reviewRevision: 0,
          reviewReason: null,
          approvedAt: null,
        };
        ["identity", "work", "cac"].forEach((dimension) =>
          evidence.push({
            id: dimension,
            dimension,
            status: "not_submitted",
            revision: 0,
            reason: null,
            submittedAt: null,
            decidedAt: null,
            uploadId: null,
          }),
        );
        return reply(201, profile);
      }
      if (!profile)
        return reply(404, {
          code: "PROVIDER_PROFILE_REQUIRED",
          message: "Create a profile first.",
        });
      if (
        url.pathname === "/api/v1/me/provider-profile" &&
        method === "PATCH"
      ) {
        Object.assign(profile, body, {
          status: "draft",
          reviewStatus: "not_submitted",
          approvedAt: null,
        });
        return reply(200, profile);
      }
      if (url.pathname.startsWith("/api/v1/me/provider-onboarding/steps/")) {
        const step = url.pathname.split("/").at(-1);
        assert.ok(
          ["profile", "services", "portfolio", "evidence", "preview"].includes(
            step,
          ),
        );
        steps[step] = {
          values: body.values,
          updatedAt: new Date().toISOString(),
        };
        return reply(200, combined());
      }
      if (url.pathname === "/api/v1/services" && method === "POST") {
        assert.equal(body.categoryId, categoryId);
        assert.equal(body.currency, "NGN");
        assert.equal(body.providerId, undefined);
        services.push({
          id: "00000000-0000-4000-8000-000000000022",
          providerId: id,
          ...body,
          priceMinor: body.priceMinor ?? null,
          status: "draft",
        });
        return reply(201, services.at(-1));
      }
      if (url.pathname.startsWith("/api/v1/me/services/")) {
        const service = services.find(
          (s) => s.id === url.pathname.split("/").at(-1),
        );
        if (!service)
          return reply(404, {
            code: "SERVICE_NOT_FOUND",
            message: "Service not found.",
          });
        if (body.status === "active" && profile.status !== "active")
          return reply(403, {
            code: "PROVIDER_NOT_PUBLISHED",
            message: "Publish first.",
          });
        Object.assign(service, body);
        return reply(200, service);
      }
      if (url.pathname === "/api/v1/me/portfolio" && method === "POST") {
        portfolio.push({
          id: "00000000-0000-4000-8000-000000000023",
          ...body,
          assetUrl: body.assetUrl ?? null,
          externalUrl: body.externalUrl ?? null,
        });
        return reply(201, portfolio.at(-1));
      }
      if (url.pathname.startsWith("/api/v1/me/portfolio/")) {
        if (method === "DELETE") {
          portfolio.pop();
          return reply(204);
        }
        Object.assign(portfolio[0], body);
        return reply(200, portfolio[0]);
      }
      if (
        url.pathname === "/api/v1/me/provider-verifications" &&
        method === "POST"
      ) {
        const upload = verification.getUpload(body.evidenceObjectKey);
        if (
          !upload ||
          upload.owner !== auth.id ||
          upload.upload.purpose !== "provider_evidence" ||
          upload.upload.status !== "ready"
        )
          return reply(409, {
            code: "EVIDENCE_NOT_READY",
            message: "Upload and scan provider evidence.",
          });
        const dimension = evidence.find((e) => e.dimension === body.dimension);
        Object.assign(dimension, {
          status: "pending",
          revision: dimension.revision + 1,
          uploadId: upload.upload.id,
          submittedAt: new Date().toISOString(),
          reason: null,
        });
        return reply(201, dimension);
      }
      if (url.pathname.endsWith("/submit")) {
        if (!combined().canSubmit)
          return reply(409, {
            code: "PROVIDER_REQUIREMENTS_INCOMPLETE",
            message: "Identity, work and a service are required.",
          });
        profile.status = "pending_verification";
        profile.reviewStatus = "pending";
        profile.reviewRevision++;
        return reply(202, profile);
      }
      if (url.pathname.endsWith("/publish")) {
        if (!combined().canPublish)
          return reply(403, {
            code: "PROVIDER_APPROVAL_REQUIRED",
            message: "Wait for admin approval.",
          });
        profile.status = "active";
        return reply(200, profile);
      }
      return reply(404, { code: "NOT_FOUND", message: "Not found." });
    },
  };
}
