import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
const backendRequire = createRequire(
  new URL("../../konet-backend/package.json", import.meta.url),
);
const { Server } = backendRequire("socket.io");
function load(file) {
  const context = { exports: {}, require, setTimeout, clearTimeout };
  vm.runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    context,
  );
  return context.exports;
}
const { RealtimeConnection } = load("src/lib/realtime/connection.ts");
const { mergeMessages } = load("src/lib/realtime/messages.ts");
const server = http.createServer();
const socketServer = new Server(server);
const namespace = socketServer.of("/chat");
const tickets = new Set();
let activeSocket;
let sendCount = 0;
let joinCount = 0;
let reconnectCount = 0;
let refreshCount = 0;
let invalidNext = false;
const stored = [];
let visible = [];
let receipt;
namespace.use((socket, next) => {
  const ticket = socket.handshake.auth.ticket;
  if (!tickets.delete(ticket))
    return next(
      Object.assign(new Error("Unauthorized"), {
        data: { code: "UNAUTHORIZED" },
      }),
    );
  assert.equal(socket.handshake.auth.token, undefined);
  assert.equal(socket.handshake.query.ticket, undefined);
  next();
});
namespace.on("connection", (socket) => {
  activeSocket = socket;
  socket.on("conversation.join", (body, ack) => {
    joinCount++;
    socket.join(body.conversationId);
    ack({ ok: true, data: { id: body.conversationId } });
  });
  socket.on("conversation.leave", (body, ack) => ack({ ok: true, data: body }));
  socket.on("conversation.read", (body, ack) => {
    const r = { ...body, userId: "provider", readAt: new Date().toISOString() };
    socket.emit("conversation.read", r);
    ack({ ok: true, data: { readAt: r.readAt } });
  });
  socket.on("message.send", (body, ack) => {
    sendCount++;
    assert.deepEqual(Object.keys(body).sort(), ["content", "conversationId"]);
    const message = {
      id: `message-${sendCount}`,
      ...body,
      senderId: "client",
      type: "text",
      createdAt: new Date().toISOString(),
    };
    stored.push(message);
    socket.emit("message.new", message);
    socket.emit("message.new", message); // Duplicate event and acknowledgement must coalesce.
    if (body.content !== "Uncertain delivery") ack({ ok: true, data: message });
  });
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const url = `http://127.0.0.1:${server.address().port}/chat`;
let ticketCount = 0;
const connection = new RealtimeConnection({
  ticket: async () => {
    const ticket = `ticket-${++ticketCount}`;
    if (invalidNext) invalidNext = false;
    else tickets.add(ticket);
    return {
      ticket,
      expiresAt: new Date(Date.now() + 30000).toISOString(),
      url,
      path: "/socket.io",
    };
  },
  refresh: async () => {
    refreshCount++;
  },
  onMessage: (message) => {
    visible = mergeMessages(visible, [message]);
  },
  onNotification: () => {},
  onReceipt: (r) => {
    receipt = r;
  },
  onReconnect: () => {
    reconnectCount++;
  },
});
function until(predicate, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeout) {
        clearInterval(timer);
        reject(
          new Error(
            `Realtime test timed out: ${JSON.stringify({ state: connection.snapshot(), joins, joinCount, sendCount, reconnectCount, refreshCount, ticketCount })}`,
          ),
        );
      }
    }, 10);
  });
}
let joins = 0;
const unwatch = connection.watchConversation("conversation-1", () => {
  joins++;
});
try {
  connection.start();
  await until(
    () => connection.snapshot().status === "connected" && joins === 1,
  );
  const first = await connection.send("conversation-1", "Hello from Socket.IO");
  assert.equal(first.id, "message-1");
  await until(() => visible.length === 1);
  assert.equal(sendCount, 1);
  await connection.read("conversation-1");
  await until(() => receipt?.userId === "provider");
  assert.equal(receipt.conversationId, "conversation-1");
  await assert.rejects(
    connection.send("conversation-1", "Uncertain delivery"),
    (error) => error.uncertain === true,
  );
  assert.equal(sendCount, 2); // A timeout must never automatically resend.
  assert.equal(stored.length, 2);
  assert.equal(visible.length, 2);
  invalidNext = true;
  activeSocket.disconnect(true);
  await until(() => reconnectCount === 2 && joins === 2, 8000);
  assert.equal(refreshCount, 1);
  assert.ok(ticketCount >= 3); // Fresh single-use ticket on every attempt.
  assert.equal(joinCount, 2);
  assert.equal(sendCount, 2);
  const older = {
    ...first,
    id: "older",
    createdAt: "2000-01-01T00:00:00.000Z",
  };
  assert.equal(mergeMessages(visible, [older, first])[0].id, "older");
  assert.equal(mergeMessages(visible, [first]).length, 2);
  unwatch();
  connection.stop();
  await assert.rejects(connection.send("conversation-1", "Offline"));
  assert.equal(sendCount, 2);
  console.log(
    "Socket.IO ticket authentication, sends, deduplication, read receipts, reconnect/rejoin, expired-auth refresh and uncertain-delivery checks passed.",
  );
} finally {
  connection.stop();
  await new Promise((resolve) => socketServer.close(resolve));
}
