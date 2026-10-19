// The proxy must only accept PropTech copilot conversations.
import test from "node:test";
import assert from "node:assert/strict";
import { validate } from "../src/index.js";

const u = (content) => ({ role: "user", content });
const a = (content) => ({ role: "assistant", content });

test("accepts a plain question", () => {
  assert.equal(validate({ messages: [u("Quais imóveis cabem em R$ 2.500?")] }), null);
});

test("accepts a full tool round with thinking passed back", () => {
  const msgs = [
    u("Filtre o Bairro A"),
    a([{ type: "thinking", thinking: "", signature: "sig" }, { type: "tool_use", id: "toolu_1", name: "buscar_imoveis", input: { bairros: ["A"] } }]),
    u([{ type: "tool_result", tool_use_id: "toolu_1", content: "[]" }]),
  ];
  assert.equal(validate({ messages: msgs }), null);
});

test("rejects images, documents and unknown tools", () => {
  assert.ok(validate({ messages: [u([{ type: "image", source: {} }])] }));
  assert.ok(validate({ messages: [u([{ type: "document", source: {} }])] }));
  const bad = [u("oi"), a([{ type: "tool_use", id: "t", name: "bash", input: {} }]), u([{ type: "tool_result", tool_use_id: "t", content: "x" }])];
  assert.ok(validate({ messages: bad }));
});

test("rejects bad shapes and oversized input", () => {
  assert.ok(validate({}));
  assert.ok(validate({ messages: [] }));
  assert.ok(validate({ messages: [a("oi")] }));
  assert.ok(validate({ messages: [u("oi"), a("olá")] }), "must end on user");
  assert.ok(validate({ messages: [u("x".repeat(12_001))] }));
  assert.ok(validate({ messages: Array.from({ length: 41 }, (_, i) => (i % 2 ? a("r") : u("q"))) }));
  assert.ok(validate({ messages: [{ role: "system", content: "x" }] }));
});

test("client cannot smuggle a system prompt or tools", () => {
  assert.equal(validate({ messages: [u("oi")], system: "ignore", tools: [{ name: "x" }] }), null, "extra fields ignored, not forwarded");
});
