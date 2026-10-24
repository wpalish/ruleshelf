import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import definition from "../module.js";
import { WorkStore } from "../core/store.js";
import { createServer } from "../core/server.js";
const steps = JSON.parse(
  readFileSync(new URL("./scenario.json", import.meta.url), "utf8"),
);
const replace = (value, ids) =>
  typeof value === "string" && value.startsWith("$")
    ? ids[value.slice(1)]
    : value;
function execute(store) {
  const ids = {};
  for (const step of steps) {
    const before = store.read(),
      command = {
        operation: step.operation || "save",
        collection: step.collection,
        id: replace(step.id, ids),
        revision: before.revision,
        data: Object.fromEntries(
          Object.entries(step.data || {}).map(([k, v]) => [k, replace(v, ids)]),
        ),
      },
      actor = {
        name: step.actor === "operator" ? "synthetic-staff" : "synthetic-admin",
        role: step.actor === "operator" ? "operator" : "admin",
      };
    if (step.error) {
      assert.throws(
        () => store.transact(command, actor),
        new RegExp(step.error, "i"),
      );
      assert.deepEqual(
        store.read(),
        before,
        "Rejected operation must preserve data and revision.",
      );
    } else {
      const result = store.transact(command, actor);
      if (step.as)
        ids[step.as] = command.id || result.data[step.collection].at(-1).id;
      if (step.expect)
        assert.ok(
          JSON.stringify(result.computed).includes(step.expect),
          JSON.stringify(result.computed),
        );
    }
  }
  return ids;
}
test(
  definition.title +
    ": complete original workflow, calculation and rejected invalid transition",
  () => {
    const store = new WorkStore(definition);
    try {
      execute(store);
    } finally {
      store.close();
    }
  },
);
test("real file restart, optimistic conflict and validated restore into an empty database", () => {
  const folder = mkdtempSync(join(tmpdir(), definition.slug + "-")),
    path = join(folder, "workspace.sqlite");
  let store = new WorkStore(definition, path);
  try {
    execute(store);
    const copy = store.export(),
      data = store.read().data;
    store.close();
    store = new WorkStore(definition, path);
    assert.deepEqual(store.read().data, data);
    assert.throws(
      () =>
        store.transact({
          ...steps[0],
          operation: "save",
          revision: 0,
          data: steps[0].data,
        }),
      /другой вкладке/,
    );
    const empty = new WorkStore(definition);
    try {
      assert.throws(
        () => empty.restore({ ...copy, product: "another-product" }),
        /другому продукту/,
      );
      assert.equal(empty.read().revision, 0);
      empty.restore(copy);
      assert.deepEqual(empty.read().data, data);
      assert.throws(() => empty.restore(copy), /пустую базу/);
    } finally {
      empty.close();
    }
  } finally {
    store.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
test("HTTP prevents anonymous reads and cross-origin/CSRF writes while authenticated workflow saves", async (t) => {
  const password = "Synthetic-only-password-2026!",
    { server, store } = createServer(definition, {
      admin: { username: "admin", password },
    });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = "http://127.0.0.1:" + server.address().port;
  const request = async (path, method = "GET", data, extra = {}) => {
    const r = await fetch(origin + path, {
      method,
      headers: {
        Origin: origin,
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...extra,
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  };
  for (const path of ["/api/state", "/api/backup", "/api/audit"])
    assert.equal((await request(path)).status, 401);
  const auth = await request("/api/login", "POST", {
    username: "admin",
    password,
  });
  assert.equal(auth.status, 200);
  assert.match(auth.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  const cookie = auth.headers.get("set-cookie").split(";")[0],
    headers = { Cookie: cookie, "X-CSRF-Token": auth.data.user.csrf },
    command = {
      operation: "save",
      revision: 0,
      collection: steps[0].collection,
      data: steps[0].data,
    };
  assert.equal(
    (await request("/api/command", "POST", command, { Cookie: cookie })).status,
    403,
  );
  assert.equal(
    (
      await request("/api/command", "POST", command, {
        ...headers,
        Origin: "https://attacker.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/command", "POST", command, headers)).status,
    200,
  );
  assert.equal(
    (await request("/api/state", "GET", null, headers)).data.revision,
    1,
  );
  await request("/api/logout", "POST", {}, headers);
  assert.equal((await request("/api/state", "GET", null, headers)).status, 401);
});
if (definition.publicForm)
  test("published public form saves a validated submission without exposing private workspace", async (t) => {
    const { server, store } = createServer(definition);
    const ids = execute(store),
      id = Object.values(ids)[0];
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const origin = "http://127.0.0.1:" + server.address().port,
      form = await (await fetch(origin + "/api/public/" + id)).json();
    assert.ok(form.fields.length);
    const input =
      definition.slug === "formakz"
        ? { q0: "Тестовая публичная заявка", q1: "Учебный день" }
        : { quantity: 2, contact: "", total: 0 };
    const r = await fetch(origin + "/api/public/" + id, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const receipt = await r.json();
    assert.equal(r.status, 201);
    assert.ok(receipt.id);
    if (definition.slug === "quotegate")
      assert.equal(receipt.total, "12500.00");
    assert.equal(receipt.data, undefined);
  });

test('two products on one host use isolated session cookies and preserve both logins',async t=>{
 const password='Synthetic-isolation-password!',one=createServer(definition,{admin:{username:'admin',password}}),two=createServer({...definition,slug:definition.slug+'-isolated'},{admin:{username:'other',password}});
 await Promise.all([one,two].map(x=>new Promise(resolve=>x.server.listen(0,'127.0.0.1',resolve))));t.after(()=>Promise.all([one,two].map(x=>new Promise(resolve=>x.server.close(resolve)))));
 const origins=[one,two].map(x=>'http://127.0.0.1:'+x.server.address().port),cookies=[];
 for(let i=0;i<2;i++){const r=await fetch(origins[i]+'/api/login',{method:'POST',headers:{Origin:origins[i],'Content-Type':'application/json'},body:JSON.stringify({username:i?'other':'admin',password})});assert.equal(r.status,200);cookies.push(r.headers.get('set-cookie').split(';')[0]);}
 assert.notEqual(cookies[0].split('=')[0],cookies[1].split('=')[0]);
 for(const origin of origins)assert.equal((await fetch(origin+'/api/state',{headers:{Cookie:cookies.join('; ')}})).status,200);
 assert.equal((await fetch(origins[0]+'/api/state',{headers:{Cookie:cookies[1]}})).status,401);
});
