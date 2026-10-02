# Collaboration integration guide

The collaboration API now implements participant-only jobs, conversations, text messages, read timestamps, notifications, preferences and provider-managed milestones. All routes require a live bearer session. Use Swagger and the exported OpenAPI snapshot for exact schemas.

## Job workspace

`GET /jobs` supports limit (default 20, maximum 100), offset and job status. `GET /jobs/{id}` and `GET /jobs/{id}/conversation` are private to the client and assigned provider. Unrelated users receive 404.

The provider starts a scheduled, funded job through `POST /jobs/{id}/start` and submits completed work through `POST /jobs/{id}/mark-complete`. Submission requires all milestones to be complete. The client confirms through `POST /jobs/{id}/confirm-completion`. These actions return HTTP 200 and support retries while the job remains in the target state. Every transition locks the job, records an audit event and notifies the other participant atomically.

Starting work and confirming completion require a funded/held payment record. There is no client endpoint that schedules or funds a job. Payment gateway verification will supply this transition in F8. Client confirmation records job completion and leaves the payment unchanged; it does not release money.

`POST /jobs/{id}/cancel` takes a reason. Either participant may cancel an `awaiting_payment` job whose payment is pending or failed. Funded jobs cannot be cancelled through this action until the refund workflow exists. Concurrent retries produce one cancellation and one audit event.

## Milestones

Both participants can read `GET /jobs/{id}/milestones`. Only the provider can create through POST or update through `PATCH /jobs/{id}/milestones/{milestoneId}`.

A job supports up to 50 milestones. Titles contain 3–160 characters, descriptions at most 10,000, and supplied due dates must be in the future. Progress is `pending`, `in_progress`, or `completed`; it cannot move backwards. Progress beyond pending requires a started job. Milestone changes serialize with job actions and are blocked after submission, completion, cancellation or dispute. A milestone ID belonging to another job receives 404.

Milestones describe work; they do not create separate charges or payouts.

## Conversations and delivery

- `GET /conversations`: paginated participant-owned list ordered by latest activity.
- `GET /conversations/{id}`: detail including participant IDs.
- `GET /conversations/{id}/messages`: ascending timestamp/ID, paginated with limit/offset.
- `POST /conversations/{id}/messages`: nonblank text, maximum 10,000 characters.
- `PATCH /conversations/{id}/read`: persists your read timestamp and marks existing notifications for that conversation read; returns `message` and `readAt`.

Messages, conversation activity, and recipient notifications are committed together. Conversation read actions serialize with message sends so later messages are not marked read accidentally. Messages remain readable after job completion. Only authenticated participants may read or send.

Delivery uses **Socket.IO** on the same backend port, namespace `/chat`, transport path `/socket.io`. It supports WebSocket with Socket.IO HTTP fallback. Use the Socket.IO client rather than the browser's raw WebSocket API. REST remains available for history and reconnect recovery. No typing indicators, message attachments or email message delivery is implemented.

Connect using `auth: { token: accessToken }`. The server checks the JWT, active account, and live database session at connection, before each action and before each outbound delivery. Idle sessions are checked every 30 seconds. Revoked/expired sessions disconnect; refresh through REST and reconnect with the new access token. Browser origins must match the origin of `FRONTEND_URL`; do not place tokens in query strings.

| Client event | Payload | Acknowledgement data |
| --- | --- | --- |
| `conversation.join` | `{conversationId}` | Conversation detail; participants only |
| `conversation.leave` | `{conversationId}` | Conversation ID |
| `message.send` | `{conversationId, content}` | Persisted message |
| `conversation.read` | `{conversationId}` | Read acknowledgement and timestamp |

All acknowledgements are `{ok:true,data}` or `{ok:false,error:{code,message}}`. Payloads reject undocumented fields; sender identity comes from the authenticated session. Maximum 100 actions/minute/socket, 50 joined conversations, and 64 KiB transport payload. Text messages retain the 10,000-character limit.

| Server event | Payload and audience |
| --- | --- |
| `message.new` | Persisted message, to participant sockets that joined the conversation |
| `conversation.read` | `{conversationId,userId,readAt}`, to joined participant sockets |
| `notification.new` | Persisted notification, to that user's connected sockets (conversation join not required) |

REST message sends broadcast the same events. Message writes and notifications complete before events publish; failures emit no message. Collaboration milestones/job actions also push their notifications. Other feature notifications retain REST retrieval until those emitters are connected.

```ts
import { io } from "socket.io-client";

const socket = io(`${API_ORIGIN}/chat`, {
  path: "/socket.io",
  auth: { token: accessToken },
});
socket.on("message.new", message => upsertMessageById(message));
socket.on("notification.new", notification => upsertNotificationById(notification));
socket.on("conversation.read", receipt => updateReadReceipt(receipt));
socket.on("connect", () => {
  socket.emit("conversation.join", { conversationId }, async result => {
    if (result.ok) await reloadConversationHistory();
  });
  reloadNotifications();
});
socket.emit("message.send", { conversationId, content }, result => {
  if (result.ok) upsertMessageById(result.data);
  else showMessageError(result.error.message);
});
```

Install `socket.io-client` in the frontend. Join again on every connection and load history after joining. De-duplicate incoming and acknowledged messages by persisted message ID. On a connection authentication error, refresh the token, set `socket.auth = {token: newAccessToken}`, and call `socket.connect()`.

Live events are best effort and are not replayed after disconnection or process failure. PostgreSQL is the source of truth; refetch history/notifications on reconnect. Message submission has no idempotency key: do not enable automatic send retries after acknowledgement timeouts. Load history to resolve an uncertain submission before retrying.

The current socket adapter runs on one API instance. Multiple API replicas require a shared adapter (such as Redis) and deployment routing configuration before enabling cross-instance live delivery. No Redis credentials are required for the current single-instance setup. Protocol references: [Socket.IO transport](https://socket.io/docs/v4/how-it-works) and [delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/).

## Notifications and preferences

`GET /notifications` accepts pagination and `status=read|unread`. `PATCH /notifications/{id}/read` preserves the original read time on retries. `PATCH /notifications/read-all` marks only your unread rows and returns `message` and `updatedCount`.

`GET/PATCH /me/notification-preferences` returns `emailEnabled` and `inAppEnabled`, both true by default. PATCH requires actual JSON booleans. Disabling in-app notifications suppresses new optional collaboration notifications, not existing records or mandatory verification/security notifications. Other feature notifications retain their existing behavior. Email preference is persisted for future optional email features; it does not disable password recovery or verification codes and does not enable hiring/message emails.

## Configuration and migration

Resend and Cloudinary placeholders are in `konet-backend/.env`. Existing values were preserved. Fill the three Resend settings together: `RESEND_API_KEY`, verified sender `EMAIL_FROM`, and a 64-character hexadecimal `EMAIL_OUTBOX_KEY` (generate with `openssl rand -hex 32`). Set `PASSWORD_RESET_URL` to the frontend reset page if needed.

Fill `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` together. Enable `CLOUDINARY_MALWARE_SCAN_ENABLED` only once malware moderation is active in the account. `EVIDENCE_RETENTION_DAYS` defaults to 30. Empty optional credentials leave integrations unconfigured without blocking startup. Socket.IO uses the existing `FRONTEND_URL` and JWT settings; no additional credentials are needed.

Migration 0005 creates `job_milestones`, `conversation_reads` and `notification_preferences`. Apply it with `npm run db:migrate` for every deployment. Integration tests use separate disposable databases and include private access, preference validation, message/read persistence, milestones, cancellation races and confirmation without payment release.
