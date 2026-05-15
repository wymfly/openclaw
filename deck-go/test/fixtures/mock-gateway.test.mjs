import assert from "node:assert/strict";
import test from "node:test";
import WebSocket from "ws";
import { startMockGateway } from "./mock-gateway.mjs";

function createFrameReader(socket) {
  const queue = [];
  const waiters = [];
  socket.on("message", (raw) => {
    let frame;
    try {
      frame = JSON.parse(String(raw));
    } catch (error) {
      for (const waiter of waiters.splice(0)) {
        waiter.reject(error);
      }
      return;
    }
    const waiter = waiters.shift();
    if (waiter) {
      waiter.resolve(frame);
      return;
    }
    queue.push(frame);
  });
  socket.on("error", (error) => {
    for (const waiter of waiters.splice(0)) {
      waiter.reject(error);
    }
  });
  return () => {
    const frame = queue.shift();
    if (frame) {
      return Promise.resolve(frame);
    }
    return new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
    });
  };
}

async function request(socket, readFrame, method, params = {}) {
  const id = `${method}-${Date.now()}-${Math.random()}`;
  socket.send(JSON.stringify({ type: "req", id, method, params }));
  for (;;) {
    const frame = await readFrame();
    if (frame.type === "res" && frame.id === id) {
      return frame;
    }
  }
}

void test("mock gateway exposes a health endpoint for fixture readiness", async (t) => {
  const gateway = await startMockGateway({ token: "token-1" });
  t.after(async () => {
    await gateway.close();
  });

  const response = await fetch(`${gateway.url}/healthz`);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "OK\n");
});

void test("mock gateway speaks connect and basic passthrough RPC", async (t) => {
  const gateway = await startMockGateway({ token: "token-1" });
  t.after(async () => {
    await gateway.close();
  });

  const socket = new WebSocket(gateway.wsUrl);
  const readFrame = createFrameReader(socket);
  t.after(() => socket.close());
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  const challenge = await readFrame();
  assert.equal(challenge.type, "event");
  assert.equal(challenge.event, "connect.challenge");

  const connect = await request(socket, readFrame, "connect", { auth: { token: "token-1" } });
  assert.deepEqual(connect.payload, { ok: true, protocol: 3 });

  const describe = await request(socket, readFrame, "gateway.describe");
  assert.equal(describe.payload.gatewayVersion, "mock-gateway");

  const created = await request(socket, readFrame, "sessions.create", { message: "hello" });
  assert.equal(created.payload.sessionKey, "session:mock:1");

  const sent = await request(socket, readFrame, "sessions.send", {
    sessionKey: created.payload.sessionKey,
    message: "hello",
  });
  assert.equal(sent.payload.blocks[0].text, "mock reply: hello");
});

void test("mock gateway rejects invalid tokens during connect", async (t) => {
  const gateway = await startMockGateway({ token: "token-1" });
  t.after(async () => {
    await gateway.close();
  });

  const socket = new WebSocket(gateway.wsUrl);
  const readFrame = createFrameReader(socket);
  t.after(() => socket.close());
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  await readFrame();

  const connect = await request(socket, readFrame, "connect", { auth: { token: "wrong" } });
  assert.equal(connect.error.code, "unauthorized");
});
