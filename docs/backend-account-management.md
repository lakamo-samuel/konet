# Student account management

Migration `0009_rapid_zombie.sql` adds email-change challenges. All four routes require a live Bearer session.

## Profile

`PATCH /me/profile` accepts at least one of `fullName` (2–150 characters), `avatarUrl` (HTTPS, at most 2048 characters), `universityId` and `campusId`. Null values and privileged fields are rejected. The selected campus must belong to the active university; moving to another university generally requires sending its campus ID too. Password hashes are never returned.

Changing university/campus requires no active jobs or outstanding money. It resets student verification to `unverified`, invalidates pending verification challenges and resets provider approval/publication. Historical decisions/evidence are retained. Students must verify the new affiliation, and providers must submit for review and publish again. Name/avatar changes do not reset student verification.

## Email change

`POST /me/email-change` takes `email` and the current `password`. It returns HTTP 202 with `challengeId`, `expiresAt` and `resendAfter`. Resend, `EMAIL_FROM` and `EMAIL_OUTBOX_KEY` must be configured; otherwise it returns 503. The existing encrypted outbox sends a six-digit code to the new address. Codes expire after ten minutes, have a 60-second resend cooldown and allow at most three requests/hour. New requests invalidate old codes.

`POST /me/email-change/confirm` takes `challengeId` and `code`. It allows five attempts per challenge, validates ownership and the original account email/password context, and checks address uniqueness at commit. A password change/reset makes an older code unusable. Success returns the updated user, revokes every session and clears the refresh cookie. The frontend must sign the user out and use the new email for login. An encrypted outbox message alerts the original address. University verification is separate from login-email ownership and remains unchanged.

Both request and confirmation reject changes while active work or collected/processing/unsettled payment obligations exist, preventing a payer-email change during payment verification. API acknowledgements mean email is queued, not guaranteed delivered.

## Account deactivation

`DELETE /me/account` takes `reason` (3–2000 characters) and returns 204. It marks the account deactivated, hides its provider profile, revokes sessions, invalidates outstanding recovery/email/verification codes and cancels queued email. The frontend clears account state. Active work and unsettled payments return 409 `ACCOUNT_OBLIGATIONS_PENDING`; these must be resolved first.

This operation retains account, job, message, review, audit and financial records. It does not erase historical records or release/refund money. Deactivated accounts cannot log in or register another account with the same email. There is no self-service reactivation endpoint.
