import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import definition from "../module.js";
import { WorkStore } from "../core/store.js";

const policy = (name, status = "draft", overrides = {}) => ({ name,
  owner: "SYNTHETIC owner", body: "SYNTHETIC version one", source: "https://example.org/policy",
  version: 1, validUntil: "2026-10-24", status, ...overrides });
const ack = (parent, person = "SYNTHETIC staff", version = 1) => ({ policy: parent,
  person, version, evidence: "SYNTHETIC manual acknowledgment" });
function save(store, collection, data, id) {
  const result = store.transact({ operation: "save", collection, data, id, revision: store.read().revision });
  return id || result.data[collection].at(-1).id;
}
const events = (store) => store.db.prepare("SELECT * FROM audit ORDER BY rowid").all();
function rejected(store, action, pattern) {
  const before = store.read(), audit = events(store);
  assert.throws(action, pattern);
  assert.deepEqual(store.read(), before);
  assert.deepEqual(events(store), audit);
}

test("expired approved history permits unrelated work/archive but rejects new late acknowledgments", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-24T12:00:00Z") });
  const store = new WorkStore(definition);
  try {
    const p = save(store, "policies", policy("SYNTHETIC history"));
    save(store, "policies", policy("SYNTHETIC history", "approved"), p);
    const a = save(store, "acks", ack(p)), original = store.read().data;
    t.mock.timers.setTime(Date.parse("2026-10-25T00:00:01Z"));
    save(store, "policies", policy("SYNTHETIC unrelated draft"));
    assert.deepEqual(store.read().data.acks, original.acks);
    assert.deepEqual(store.read().data.policies[0], original.policies[0]);
    rejected(store, () => save(store, "acks", ack(p, "SYNTHETIC late staff")), /действующей/);
    rejected(store, () => save(store, "acks", { ...ack(p), evidence: "SYNTHETIC altered evidence" }, a), /нельзя менять/);
    store.transact({ operation: "archive", collection: "policies", id: p, revision: store.read().revision });
    assert.equal(store.read().data.policies[0].status, "approved");
    assert.equal(store.read().data.policies[0].validUntil, "2026-10-24");
    assert.deepEqual(store.read().data.acks, original.acks);
  } finally { store.close(); }
});

test("date transition, file restart and restore preserve old acknowledgments through an explicit new version", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-24T12:00:00Z") });
  const folder = mkdtempSync(join(tmpdir(), "ruleshelf-lifecycle-")), path = join(folder, "workspace.sqlite");
  let store = new WorkStore(definition, path);
  const restored = new WorkStore(definition);
  try {
    const p = save(store, "policies", policy("SYNTHETIC versioned history"));
    save(store, "policies", policy("SYNTHETIC versioned history", "approved"), p);
    save(store, "acks", ack(p));
    const before = store.read(), audit = events(store), copy = store.export();
    store.close();
    t.mock.timers.setTime(Date.parse("2026-10-25T12:00:00Z"));
    store = new WorkStore(definition, path);
    assert.deepEqual(store.read(), before); assert.deepEqual(events(store), audit);
    restored.restore(copy);
    assert.deepEqual(restored.read().data, before.data);
    assert.deepEqual(restored.read().computed, before.computed);
    save(restored, "policies", policy("SYNTHETIC independent draft"));
    save(restored, "policies", policy("SYNTHETIC versioned history"), p);
    rejected(restored, () => save(restored, "policies", policy("SYNTHETIC versioned history", "approved"), p), /просроченный/);
    const v2 = policy("SYNTHETIC versioned history", "draft", {
      body: "SYNTHETIC version two", version: 2, validUntil: "2026-10-30" });
    save(restored, "policies", v2, p);
    save(restored, "policies", { ...v2, status: "approved" }, p);
    assert.deepEqual(restored.read().data.acks, before.data.acks, "Old v1 acknowledgment is not silently rebased");
    rejected(restored, () => save(restored, "acks", ack(p, "SYNTHETIC old-version staff", 1)), /действующей/);
    save(restored, "acks", ack(p, "SYNTHETIC staff", 2));
    rejected(restored, () => save(restored, "acks", ack(p, "SYNTHETIC staff", 2)), /дубликаты/);
    save(restored, "policies", { ...v2, status: "retired" }, p);
    rejected(restored, () => save(restored, "acks", ack(p, "SYNTHETIC retired staff", 2)), /действующей/);
    assert.equal(restored.read().data.acks[0].version, 1);
    assert.equal(restored.read().data.acks[1].version, 2);
  } finally { store.close(); restored.close(); rmSync(folder, { recursive: true, force: true }); }
});

test("archived approved policy cannot receive new acknowledgments; existing history restores unchanged", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-24T12:00:00Z") });
  const store = new WorkStore(definition), restored = new WorkStore(definition);
  try {
    const draft = policy("SYNTHETIC archive", "draft", { validUntil: "2026-10-30" });
    const p = save(store, "policies", draft);
    save(store, "policies", { ...draft, status: "approved" }, p);
    save(store, "acks", ack(p));
    const original = store.read().data.acks;
    store.transact({ operation: "archive", collection: "policies", id: p, revision: store.read().revision });
    rejected(store, () => save(store, "acks", ack(p, "SYNTHETIC archive-late staff")), /действующей/);
    restored.restore(store.export());
    assert.deepEqual(restored.read().data, store.read().data);
    assert.deepEqual(restored.read().data.acks, original);
    rejected(restored, () => save(restored, "acks", ack(p, "SYNTHETIC restored-archive staff")), /действующей/);
  } finally { store.close(); restored.close(); }
});
