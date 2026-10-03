# Frontend Socket.IO messaging

## Connected screens

`/messages` lists the signed-in participant's conversations with pagination and a search over IDs on the current page. Conversation entries use the associated job/request IDs from the backend. They do not fabricate names, avatars or recent-message previews from unavailable profile data. `/messages/{id}` reads the private conversation and its history. Jobs use `/jobs/{id}/conversation` to open the correct thread. Other users receive backend errors rather than substituted records.

Messages use canonical `content`, `type`, sender ID and timestamps. The unused local-only composer is deleted. The backend returns ascending history, so the thread loads successive 100-message pages until caught up. It displays progress and errors; message sending waits for history to finish. Large conversations consequently need multiple history requests. Socket.IO events are merged with history by persisted message ID and sorted by timestamp/ID, including the sender's acknowledgement. Duplicate events never create additional bubbles.

## Authentication and connection

Authenticated app/provider screens share one Socket.IO connection per mounted account through `RealtimeProvider`. The browser calls the central `realtimeTicket` command, which authenticates through the existing development bearer or production HttpOnly-cookie boundary. The backend returns an opaque, single-use ticket valid for 30 seconds. It is used as `auth: {ticket}` in namespace `/chat`; it is not saved to localStorage, passed as a query parameter, or accepted for REST authorization. Production access JWTs and refresh cookies stay private.

The connection obtains a fresh ticket for every attempt, rejoins active rooms on reconnect and reloads REST history/inbox/notifications. Authentication failures use the existing REST session refresh coordinator. Terminal session failures show an explicit error; transient connection failures use bounded exponential retry delays. Account switching, logout and unmount disconnect and remove handlers. Late acknowledgements from an earlier connection cannot update the new account's cache.

Socket.IO uses its normal transport fallback. There is no interval polling of conversation/message history. REST is used for initial history, recovery and metadata refresh in response to events. The backend already verifies live JWT/session/account status before actions, outbound delivery and periodic idle-session checks.

## Sends, read receipts and recovery

Messages send through `message.send`, with only `{conversationId,content}`; the authenticated backend chooses the sender. Nonblank messages may contain up to 10,000 characters. The UI disables duplicate submission and sending while offline/loading/recovering. There is no automatic resend or offline send queue.

A lost acknowledgement reports uncertain delivery and keeps the draft. The user must reload history and inspect whether the persisted message arrived before choosing to retry. A committed message may already have appeared through `message.new`, even if its acknowledgement was lost. A socket reconnection never repeats a pending send.

After history is caught up, a visible thread sends `conversation.read`, debounced for bursts. It does not mark incoming messages read while the tab is hidden. Read events identify the reader and server timestamp. The thread shows peer read confirmation only when an actual peer receipt covers the message timestamp. Historical receipts are not returned by the current detail API; opening a thread does not fabricate them. Conversation reads also refresh the notification cache. Collaboration `notification.new` events refresh the inbox and notification queries. The header bell uses the unread-filtered notification query, so message/read events update its badge without a page reload. It requests up to 100 unread records and displays `99+` at that limit rather than inferring the count from only the newest mixed read/unread page.

## Configuration

Optional server-only placeholders are in `konet-frontend/.env.local` and `.env.example`:

```dotenv
KONET_SOCKET_URL=
KONET_SOCKET_PATH=
```

Blank values use the origin of `KONET_API_URL` with namespace `/chat` and transport path `/socket.io`. For a deployed API, `KONET_API_URL=https://YOUR_API_HOST/api/v1` normally needs no separate socket setting. A reverse proxy may need explicit socket URL/path overrides and WebSocket upgrade forwarding. Set exact allowed frontend origins, including localhost ports, in backend `CORS_ORIGINS`.

Deploy the backend socket-ticket endpoint before using this frontend version. Swagger/exported OpenAPI includes its request/response contract. No migration or external messaging credentials are required for this stage. The current backend and ticket store run on one API instance: issuance and socket handshake must reach the same instance. Multiple replicas need shared ticket storage, a shared socket adapter and deployment routing before live delivery works across replicas.

## Validation and remaining work

Run frontend typecheck, lint and build, both HTTP integration modes, and `npm run test:realtime`. HTTP fixtures cover endpoint payloads, pagination, participant restrictions, invalid text, read acknowledgement and ticket privacy. The Socket.IO test uses a disposable real Socket.IO server and the frontend connection controller to verify sends, duplicate broadcasts/acknowledgements, read receipts, reconnect/rejoin, authentication refresh, offline rejection and a persisted message with a deliberately lost acknowledgement. It sends no real user messages.

Backend tests use a disposable PostgreSQL database for ticket issuance, one-time redemption, REST rejection, session/participant enforcement and existing socket delivery. A separate ticket unit test checks expiry and unknown credentials. Swagger contract checks and export validate all 152 operations.

Browser interaction across two real accounts and deployed proxy/CORS behavior still need deployment checks. Typing indicators and message attachments are not implemented. Backend multi-instance live delivery remains a separate infrastructure stage. Completed-job reviews are connected; see [frontend reviews](frontend-reviews.md). Next frontend work is disputes and account/provider settings; admin frontend remains deferred.
