import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { WorkStore, required, problem } from "./store.js";

const digest = (text) => createHash("sha256").update(text).digest("hex"),
  random = () => randomBytes(32).toString("hex");
function encode(password) {
  required(
    typeof password === "string" &&
      password.length >= 14 &&
      password.length <= 200,
    "Пароль: 14–200 символов.",
  );
  const salt = random();
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function matches(password, value) {
  if (typeof password !== "string" || password.length > 200) return false;
  const [salt, key] = value.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(key, "hex"),
  );
}
const cookie = (req, name) =>
  (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="))
    ?.slice(name.length + 1) || "";
async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    required(size <= 2097152, "Запрос превышает 2 МБ.");
    chunks.push(chunk);
  }
  required(
    (req.headers["content-type"] || "").startsWith("application/json"),
    "Нужен JSON.",
  );
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString());
    required(
      data && typeof data === "object" && !Array.isArray(data),
      "Нужен объект.",
    );
    return data;
  } catch {
    throw problem("Неверный JSON.");
  }
}
export function createServer(
  definition,
  { database = ":memory:", origin = null, admin, now = () => Date.now() } = {},
) {
  const store = new WorkStore(definition, database),
    db = store.db;
  const cookieName = "work_" + definition.slug.replace(/-/g,"_") + "_session";
  db.exec(
    "CREATE TABLE IF NOT EXISTS users(name TEXT PRIMARY KEY,password TEXT NOT NULL,role TEXT NOT NULL);CREATE TABLE IF NOT EXISTS sessions(digest TEXT PRIMARY KEY,username TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS failures(name TEXT PRIMARY KEY,count INTEGER NOT NULL,since INTEGER NOT NULL);",
  );
  function userCreate(input) {
    required(
      typeof input.username === "string" &&
        /^[a-zA-Z0-9_.-]{3,80}$/.test(input.username),
      "Имя: 3–80 латинских знаков.",
    );
    required(["admin", "operator"].includes(input.role), "Выберите роль.");
    db.prepare("INSERT INTO users VALUES(?,?,?)").run(
      input.username,
      encode(input.password),
      input.role,
    );
    return { username: input.username, role: input.role };
  }
  if (admin && !db.prepare("SELECT name FROM users LIMIT 1").get())
    userCreate({ ...admin, role: "admin" });
  function session(req) {
    return db
      .prepare(
        "SELECT u.name,u.role,s.csrf FROM sessions s JOIN users u ON u.name=s.username WHERE s.digest=? AND s.expires>?",
      )
      .get(digest(cookie(req, cookieName)), now());
  }
  function auth(req, role) {
    const user = session(req);
    if (!user) throw problem("Войдите в рабочий кабинет.", 401);
    if (role === "admin" && user.role !== "admin")
      throw problem("Нужна роль администратора.", 403);
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-csrf-token"] !== user.csrf
    )
      throw problem("Обновите страницу перед сохранением.", 403);
    return user;
  }
  function send(res, status, data, headers = {}) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    });
    res.end(JSON.stringify(data));
  }
  const limits = new Map();
  const server = http.createServer(async (req, res) => {
    for (const [k, v] of Object.entries({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    }))
      res.setHeader(k, v);
    try {
      const base = origin || `http://127.0.0.1:${server.address().port}`,
        path = new URL(req.url, base).pathname,
        method = req.method,
        mutating = !["GET", "HEAD"].includes(method);
      required(
        req.headers.host === new URL(base).host,
        "Неверный адрес сервера.",
      );
      if (mutating && req.headers.origin !== base)
        throw problem("Запрос должен исходить из приложения.", 403);
      const ip = req.socket.remoteAddress || "local";
      let limit = limits.get(ip);
      if (!limit || now() - limit.since > 60000)
        limit = { count: 0, since: now() };
      limit.count++;
      limits.set(ip, limit);
      if (limit.count > 240)
        throw problem("Слишком много запросов. Подождите минуту.", 429);
      if (limits.size > 5000)
        for (const [k, v] of limits)
          if (now() - v.since > 60000) limits.delete(k);
      if (method === "GET" && path === "/api/config")
        return send(res, 200, {
          slug: definition.slug,
          title: definition.title,
          description: definition.description,
          limitations: definition.limitations,
          collections: definition.collections,
        });
      if (method === "GET" && path === "/api/session")
        return send(res, 200, { user: session(req) || null });
      const publicRoute = path.match(/^\/api\/public\/([a-f0-9-]{36})$/);
      if (publicRoute && definition.publicForm) {
        const current = store.read(),
          form = definition.publicForm(current.data, publicRoute[1]);
        required(form, "Форма не найдена или ещё не опубликована.");
        if (method === "GET") return send(res, 200, form);
        if (method === "POST") {
          const input = await body(req);
          required(!input.website, "Не удалось принять заявку.");
          const command = definition.publicCommand(
            current.data,
            publicRoute[1],
            input,
          );
          command.revision = current.revision;
          command.operation = "save";
          const saved = store.transact(command, {
            name: "public-visitor",
            role: "visitor",
          });
          const row = saved.data[command.collection].at(-1);
          return send(res, 201, {
            id: row.id,
            message: "Заявка сохранена.",
            ...(definition.publicReceipt ? definition.publicReceipt(row) : {}),
          });
        }
      }
      if (method === "POST" && path === "/api/login") {
        const input = await body(req),
          name = digest(ip + ":" + input.username),
          failure = db.prepare("SELECT * FROM failures WHERE name=?").get(name);
        if (failure && now() - failure.since < 900000 && failure.count >= 5)
          throw problem(
            "Подождите 15 минут после пяти неудачных попыток.",
            429,
          );
        const user =
          typeof input.username === "string"
            ? db.prepare("SELECT * FROM users WHERE name=?").get(input.username)
            : null;
        if (!user || !matches(input.password, user.password)) {
          const recent = failure && now() - failure.since < 900000;
          db.prepare(
            "INSERT INTO failures VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET count=excluded.count,since=excluded.since",
          ).run(
            name,
            recent ? failure.count + 1 : 1,
            recent ? failure.since : now(),
          );
          throw problem("Проверьте имя пользователя и пароль.", 401);
        }
        db.prepare("DELETE FROM failures WHERE name=?").run(name);
        db.prepare("DELETE FROM sessions WHERE expires<=?").run(now());
        const key = random(),
          csrf = random();
        db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
          digest(key),
          user.name,
          csrf,
          now() + 28800000,
        );
        return send(
          res,
          200,
          { user: { name: user.name, role: user.role, csrf } },
          {
            "Set-Cookie": `${cookieName}=${key}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${base.startsWith("https:") ? "; Secure" : ""}`,
          },
        );
      }
      if (method === "POST" && path === "/api/logout") {
        auth(req);
        db.prepare("DELETE FROM sessions WHERE digest=?").run(
          digest(cookie(req, cookieName)),
        );
        return send(
          res,
          200,
          { ok: true },
          {
            "Set-Cookie":
              `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
          },
        );
      }
      if (method === "POST" && path === "/api/users") {
        auth(req, "admin");
        return send(res, 201, userCreate(await body(req)));
      }
      if (method === "GET" && path === "/api/state") {
        auth(req);
        return send(res, 200, store.read());
      }
      if (method === "POST" && path === "/api/command") {
        const user = auth(req);
        return send(res, 200, store.transact(await body(req), user));
      }
      if (method === "GET" && path === "/api/backup") {
        auth(req, "admin");
        return send(res, 200, store.export());
      }
      if (method === "POST" && path === "/api/restore") {
        const user = auth(req, "admin");
        return send(res, 200, store.restore(await body(req), user));
      }
      if (method === "GET" && path === "/api/audit") {
        auth(req, "admin");
        return send(res, 200, {
          events: db
            .prepare(
              "SELECT at,actor,command FROM audit ORDER BY rowid DESC LIMIT 300",
            )
            .all()
            .map((x) => ({ ...x, command: JSON.parse(x.command) })),
        });
      }
      if (method === "GET" && ["/", "/app.js", "/styles.css"].includes(path)) {
        const filename = path === "/" ? "index.html" : path.slice(1),
          data = await readFile(
            fileURLToPath(new URL("../public/" + filename, import.meta.url)),
          );
        res.writeHead(200, {
          "Content-Type": filename.endsWith(".js")
            ? "text/javascript"
            : filename.endsWith(".css")
              ? "text/css"
              : "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
        });
        return res.end(data);
      }
      throw problem("Адрес не найден.", 404);
    } catch (e) {
      send(res, e.status || 400, {
        error: e.message?.includes("UNIQUE constraint")
          ? "Такое имя уже существует."
          : e.message,
      });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on("close", () => store.close());
  return { server, store };
}
