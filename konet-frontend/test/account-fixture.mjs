import assert from "node:assert/strict";
export function accountFixture(users, access, refresh, university, hiring) {
  const challenges = new Map();
  let serial = 0;
  const revoke = (userId) => {
    for (const [token, u] of access) if (u.id === userId) access.delete(token);
    for (const [token, u] of refresh)
      if (u.id === userId) refresh.delete(token);
  };
  return {
    handle(url, method, body, auth, send) {
      if (
        ![
          "/api/v1/me/profile",
          "/api/v1/me/password",
          "/api/v1/me/email-change",
          "/api/v1/me/email-change/confirm",
          "/api/v1/me/account",
        ].includes(url.pathname)
      )
        return false;
      const reply = (status, data) => {
        send(status, data);
        return true;
      };
      if (!auth)
        return reply(401, {
          code: "SESSION_REQUIRED",
          message: "Sign in first.",
        });
      const entry = [...users.values()].find((e) => e.user.id === auth.id);
      const blocked = () =>
        reply(409, {
          code: "ACCOUNT_OBLIGATIONS_PENDING",
          message: "Resolve active work and unsettled payments first.",
        });
      if (url.pathname.endsWith("/profile")) {
        assert.equal(method, "PATCH");
        assert.ok(
          Object.keys(body).every((k) =>
            ["fullName", "avatarUrl", "universityId", "campusId"].includes(k),
          ),
        );
        if (
          (body.universityId && body.universityId !== auth.universityId) ||
          (body.campusId && body.campusId !== auth.campusId)
        ) {
          if (hiring.hasObligations(auth.id)) return blocked();
          if (
            (body.universityId ?? auth.universityId) !== university.id ||
            !university.campuses.some(
              (c) => c.id === (body.campusId ?? auth.campusId),
            )
          )
            return reply(422, {
              code: "INVALID_CAMPUS",
              message: "Choose a campus belonging to the university.",
            });
          auth.studentVerificationStatus = "unverified";
        }
        Object.assign(auth, body);
        return reply(200, auth);
      }
      if (url.pathname.endsWith("/password")) {
        assert.equal(method, "POST");
        assert.deepEqual(Object.keys(body).sort(), [
          "currentPassword",
          "newPassword",
        ]);
        if (entry.password !== body.currentPassword)
          return reply(401, {
            code: "INVALID_CREDENTIALS",
            message: "Current password is incorrect.",
          });
        entry.password = body.newPassword;
        revoke(auth.id);
        return reply(200, { message: "Password changed." });
      }
      if (url.pathname.endsWith("/email-change")) {
        assert.deepEqual(Object.keys(body).sort(), ["email", "password"]);
        if (hiring.hasObligations(auth.id)) return blocked();
        if (entry.password !== body.password)
          return reply(401, {
            code: "INVALID_CREDENTIALS",
            message: "Current password is incorrect.",
          });
        if (users.has(body.email))
          return reply(409, {
            code: "EMAIL_IN_USE",
            message: "Email is already used.",
          });
        for (const c of challenges.values())
          if (c.userId === auth.id) c.used = true;
        const challengeId = `00000000-0000-4000-8000-${String(++serial + 100).padStart(12, "0")}`;
        challenges.set(challengeId, {
          userId: auth.id,
          email: body.email,
          password: entry.password,
          used: false,
        });
        return reply(202, {
          challengeId,
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          resendAfter: new Date(Date.now() + 60000).toISOString(),
        });
      }
      if (url.pathname.endsWith("/confirm")) {
        assert.deepEqual(Object.keys(body).sort(), ["challengeId", "code"]);
        if (hiring.hasObligations(auth.id)) return blocked();
        const c = challenges.get(body.challengeId);
        if (
          !c ||
          c.used ||
          c.userId !== auth.id ||
          c.password !== entry.password ||
          body.code !== "123456"
        )
          return reply(422, {
            code: "INVALID_CODE",
            message: "Code is invalid or expired.",
          });
        const previous = auth.email;
        auth.email = c.email;
        users.delete(previous);
        users.set(c.email, entry);
        c.used = true;
        revoke(auth.id);
        return reply(200, auth);
      }
      assert.equal(method, "DELETE");
      assert.deepEqual(Object.keys(body), ["reason"]);
      if (hiring.hasObligations(auth.id)) return blocked();
      entry.deactivated = true;
      revoke(auth.id);
      return reply(204);
    },
  };
}
