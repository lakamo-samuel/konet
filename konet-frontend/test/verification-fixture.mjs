// Contract fixture only: real ownership, rate limits and moderation are covered by backend tests.
import assert from "node:assert/strict";
export function verificationFixture(universityId, campusId) {
  const history = [];
  const uploads = new Map();
  let emailConfigured = true;
  let storageConfigured = true;
  let challenge;
  let scans = 0;
  let rejectScan = false;
  let uploadSerial = 10;
  const challengeId = "00000000-0000-4000-8000-000000000012";
  const record = (auth, method, status, uploadId = null) => ({
    id: `verification-${history.length}`,
    method,
    status,
    userId: auth.id,
    universityId,
    campusId,
    submittedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    decidedAt: null,
    reason: null,
    uploadId,
  });
  return {
    getUpload: (key) =>
      [...uploads.values()].find((item) => item.upload.objectKey === key),
    configure: (settings) => {
      emailConfigured = settings.email ?? emailConfigured;
      storageConfigured = settings.storage ?? storageConfigured;
      rejectScan = settings.rejectScan ?? rejectScan;
    },
    expireChallenge: () => {
      challenge.expiresAt = new Date(0).toISOString();
    },
    decide: (user, status, reason) => {
      history[0].status = status;
      history[0].reason = reason;
      history[0].decidedAt = new Date().toISOString();
      user.studentVerificationStatus = status;
    },
    handle(url, method, body, auth, send) {
      const reply = (status, data) => {
        send(status, data);
        return true;
      };
      if (
        url.pathname ===
        `/api/v1/universities/${universityId}/verification-methods`
      )
        return reply(200, {
          methods: ["university_email", "student_id", "manual_document"],
          approvedEmailDomains: ["test.edu"],
        });
      if (
        !url.pathname.startsWith("/api/v1/me/student-verification") &&
        !url.pathname.startsWith("/api/v1/uploads")
      )
        return false;
      if (!auth)
        return reply(401, {
          code: "SESSION_REQUIRED",
          message: "Sign in first.",
        });
      if (url.pathname === "/api/v1/me/student-verification/email-challenges") {
        assert.deepEqual(Object.keys(body), ["email"]);
        if (!emailConfigured)
          return reply(503, {
            code: "EMAIL_DELIVERY_NOT_CONFIGURED",
            message: "Email delivery is not configured.",
          });
        if (!body.email.endsWith("@test.edu"))
          return reply(400, {
            code: "UNIVERSITY_EMAIL_DOMAIN_REQUIRED",
            message: "Use an approved university email.",
          });
        challenge = {
          challengeId,
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          resendAfter: new Date(Date.now() + 60000).toISOString(),
          delivery: "email",
        };
        auth.studentVerificationStatus = "pending";
        return reply(202, challenge);
      }
      if (
        url.pathname ===
        "/api/v1/me/student-verification/email-challenges/confirm"
      ) {
        assert.equal(typeof body.code, "string");
        if (
          !challenge ||
          Date.parse(challenge.expiresAt) <= Date.now() ||
          body.challengeId !== challenge.challengeId ||
          body.code !== "000123"
        )
          return reply(400, {
            code: "VERIFICATION_CODE_INVALID",
            message: "The code is invalid or expired.",
          });
        auth.studentVerificationStatus = "verified";
        history.unshift(record(auth, "university_email", "verified"));
        challenge = null;
        return reply(200, history[0]);
      }
      if (url.pathname === "/api/v1/uploads/presign") {
        assert.deepEqual(
          Object.keys(body).sort(),
          ["purpose", "fileName", "contentType", "sizeBytes"].sort(),
        );
        if (!storageConfigured)
          return reply(503, {
            code: "STORAGE_NOT_CONFIGURED",
            message: "Storage is not configured.",
          });
        const uploadId = `00000000-0000-4000-8000-${String(++uploadSerial).padStart(12, "0")}`;
        const upload = {
          id: uploadId,
          objectKey: `konet/${body.purpose === "provider_evidence" ? "provider-evidence" : "student-evidence"}/${auth.id}/${uploadId}`,
          purpose: body.purpose,
          status: "pending",
          createdAt: new Date().toISOString(),
          retainUntil: new Date(Date.now() + 86400000).toISOString(),
        };
        uploads.set(uploadId, { upload, owner: auth.id });
        scans = 0;
        return reply(201, {
          upload,
          uploadUrl: "https://api.cloudinary.com/v1_1/test/image/upload",
          method: "POST",
          fields: {
            api_key: "public-key",
            signature: "test-signature",
            type: "authenticated",
            moderation: "perception_point",
          },
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        });
      }
      if (url.pathname.startsWith("/api/v1/uploads/")) {
        const id = url.pathname.split("/")[4];
        const found = uploads.get(id);
        if (!found || found.owner !== auth.id)
          return reply(404, {
            code: "UPLOAD_NOT_FOUND",
            message: "Upload not found.",
          });
        if (method === "DELETE") {
          uploads.delete(id);
          return reply(204);
        }
        if (url.pathname.endsWith("/complete"))
          found.upload.status = rejectScan
            ? "rejected"
            : ++scans < 2
              ? "scanning"
              : "ready";
        return reply(200, found.upload);
      }
      if (method === "GET") return reply(200, history);
      assert.ok(!("universityId" in body) && !("email" in body));
      if (
        history.some(
          (r) => r.status === "pending" && r.method !== "university_email",
        )
      )
        return reply(409, {
          code: "VERIFICATION_PENDING",
          message: "Your document is awaiting review.",
        });
      const evidence = [...uploads.values()].find(
        (item) => item.upload.objectKey === body.evidenceObjectKey,
      );
      if (!evidence || evidence.upload.status !== "ready")
        return reply(409, {
          code: "EVIDENCE_NOT_READY",
          message: "Wait for the document scan.",
        });
      auth.studentVerificationStatus = "pending";
      history.unshift(record(auth, body.method, "pending", evidence.upload.id));
      return reply(201, history[0]);
    },
  };
}
