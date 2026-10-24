import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const problem = (message, status = 400) =>
  Object.assign(new Error(message), { status });
export function required(ok, message) {
  if (!ok) throw problem(message);
}
export function minor(value) {
  const text = String(value);
  required(
    /^\d{1,10}(\.\d{1,2})?$/.test(text),
    "Денежная сумма: неотрицательное число, максимум два знака после точки.",
  );
  const [whole, part = ""] = text.split(".");
  return Number(whole) * 100 + Number(part.padEnd(2, "0"));
}
export const amount = (value) => (value / 100).toFixed(2);
export const rows = (state, key) => state[key] || [];
export const byId = (state, key, id) => {
  const row = rows(state, key).find((x) => x.id === id);
  required(row, "Связанная запись не найдена.");
  return row;
};
export function unique(items, key, label) {
  const values = items.map((x) => String(x[key]).trim().toLocaleLowerCase());
  required(
    new Set(values).size === values.length,
    `${label}: дубликаты не допускаются.`,
  );
}
export function interval(start, end) {
  const a = Date.parse(start),
    b = Date.parse(end);
  required(
    Number.isFinite(a) && Number.isFinite(b) && b > a,
    "Окончание должно быть позже начала.",
  );
  return [a, b];
}
export function noOverlap(
  items,
  resourceKey,
  startKey = "start",
  endKey = "end",
  active = (x) => x.status !== "cancelled",
) {
  const activeRows = items.filter(active);
  for (let i = 0; i < activeRows.length; i++) {
    const a = activeRows[i];
    interval(a[startKey], a[endKey]);
    for (let j = i + 1; j < activeRows.length; j++) {
      const b = activeRows[j];
      if (a[resourceKey] === b[resourceKey])
        required(
          !(
            Date.parse(a[startKey]) < Date.parse(b[endKey]) &&
            Date.parse(b[startKey]) < Date.parse(a[endKey])
          ),
          "Время пересекается с другой действующей записью.",
        );
    }
  }
}
function fieldValue(field, input, state) {
  if (input === "" || input === null || input === undefined) {
    required(field.required === false, `Заполните: ${field.label}.`);
    return "";
  }
  if (field.type === "number" || field.type === "integer") {
    const number = Number(input);
    required(
      Number.isFinite(number) &&
        number >= (field.min ?? 0) &&
        number <= (field.max ?? 1000000000) &&
        (field.type !== "integer" || Number.isInteger(number)),
      `${field.label}: неверное число.`,
    );
    return number;
  }
  const value = String(input).trim();
  required(
    value.length > 0 && value.length <= (field.maxLength || 8000),
    `${field.label}: неверная длина.`,
  );
  if (field.type === "select")
    required(
      field.options.some(
        (x) => (typeof x === "string" ? x : x.value) === value,
      ),
      `${field.label}: выберите значение из списка.`,
    );
  if (field.type === "money") minor(value);
  if (field.type === "date")
    required(
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        new Date(value).toISOString().slice(0, 10) === value,
      `${field.label}: неверная дата.`,
    );
  if (field.type === "datetime")
    required(
      Number.isFinite(Date.parse(value)) && /Z$|[+-]\d\d:\d\d$/.test(value),
      `${field.label}: укажите ISO-время с часовым поясом, например 2026-10-25T10:00:00+05:00.`,
    );
  if (field.type === "email")
    required(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      `${field.label}: неверная почта.`,
    );
  if (field.type === "url") {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw problem(`${field.label}: неверная ссылка.`);
    }
    required(
      ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password,
      "Ссылка должна быть http(s), без пароля.",
    );
  }
  if (field.type === "reference") byId(state, field.ref, value);
  return value;
}
export function cleanRow(collection, input, state) {
  const output = {};
  for (const field of collection.fields)
    output[field.key] = fieldValue(field, input[field.key], state);
  return output;
}

export class WorkStore {
  constructor(definition, path = ":memory:") {
    this.definition = definition;
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    const app = Number.parseInt(
        createHash("sha256").update(definition.slug).digest("hex").slice(0, 7),
        16,
      ),
      id = this.db.prepare("PRAGMA application_id").get().application_id,
      version = this.db.prepare("PRAGMA user_version").get().user_version,
      count = this.db
        .prepare(
          "SELECT count(*) n FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
        )
        .get().n;
    if (
      !(id === 0 && version === 0 && count === 0) &&
      (id !== app || version !== 1)
    ) {
      this.db.close();
      throw problem("Чужая база или неподдерживаемая схема. Файл не изменён.");
    }
    this.db.exec(
      `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,at TEXT NOT NULL,actor TEXT NOT NULL,command TEXT NOT NULL); PRAGMA application_id=${app}; PRAGMA user_version=1;`,
    );
    const initial = Object.fromEntries(
      definition.collections.map((x) => [x.key, []]),
    );
    this.db
      .prepare("INSERT OR IGNORE INTO workspace VALUES(1,0,?)")
      .run(JSON.stringify(initial));
  }
  close() {
    this.db.close();
  }
  read() {
    const r = this.db.prepare("SELECT * FROM workspace WHERE id=1").get();
    return {
      revision: r.revision,
      data: JSON.parse(r.payload),
      computed: this.definition.summarize(JSON.parse(r.payload)),
    };
  }
  transact(command, actor = { name: "owner", role: "admin" }) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.read();
      required(
        command.revision === current.revision,
        "Данные изменились в другой вкладке. Обновите экран перед сохранением.",
      );
      const next = structuredClone(current.data),
        collection = this.definition.collections.find(
          (x) => x.key === command.collection,
        );
      required(collection, "Неизвестный раздел.");
      const existing = command.id
        ? next[collection.key].find((x) => x.id === command.id)
        : null;
      if (command.id) required(existing, "Запись не найдена.");
      const before = existing ? structuredClone(existing) : null;
      if (collection.writeRole === "admin")
        required(
          actor.role === "admin",
          "Этот раздел изменяет только администратор.",
        );
      required(
        command.operation === "save" || command.operation === "archive",
        "Неизвестное действие.",
      );
      const now = new Date().toISOString();
      if (command.operation === "archive") {
        required(existing, "Выберите запись.");
        required(actor.role === "admin", "Архивировать может администратор.");
        existing.archived = true;
        existing.updatedAt = now;
      } else {
        required(
          !existing?.archived,
          "Архивная запись доступна только для просмотра.",
        );
        const clean = cleanRow(collection, command.data || {}, next),
          normalized = this.definition.normalizeRow
            ? this.definition.normalizeRow(
                collection.key,
                clean,
                next,
                existing,
                actor,
              )
            : clean,
          row = {
            ...normalized,
            id: existing?.id || randomUUID(),
            createdAt: existing?.createdAt || now,
            createdBy: existing?.createdBy || actor.name,
            updatedAt: now,
            archived: false,
          };
        if (existing)
          next[collection.key][next[collection.key].indexOf(existing)] = row;
        else next[collection.key].push(row);
      }
      this.definition.validate(next, current.data, command, actor);
      this.db
        .prepare("UPDATE workspace SET revision=?,payload=? WHERE id=1")
        .run(current.revision + 1, JSON.stringify(next));
      const saved = existing
        ? next[collection.key].find((x) => x.id === existing.id)
        : next[collection.key].at(-1);
      this.db
        .prepare("INSERT INTO audit VALUES(?,?,?,?)")
        .run(
          randomUUID(),
          now,
          actor.name,
          JSON.stringify({
            collection: collection.key,
            id: saved.id,
            operation: command.operation,
            before,
            after: saved,
          }),
        );
      this.db.exec("COMMIT");
      return this.read();
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  export() {
    return {
      format: "workbench-copy-v1",
      product: this.definition.slug,
      ...this.read(),
    };
  }
  restore(input, actor = { name: "owner", role: "admin" }) {
    required(actor.role === "admin", "Восстановление доступно администратору.");
    required(
      input?.format === "workbench-copy-v1" &&
        input.product === this.definition.slug,
      "Копия относится к другому продукту или формату.",
    );
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.read();
      required(
        current.revision === 0 &&
          Object.values(current.data).every((x) => x.length === 0),
        "Восстановление возможно только в пустую базу. Существующие данные не заменяются.",
      );
      const data = input.data;
      required(data && typeof data === "object", "В копии нет данных.");
      for (const c of this.definition.collections) {
        required(
          Array.isArray(data[c.key]) && data[c.key].length <= 10000,
          "Неверный раздел копии.",
        );
        const ids = new Set();
        for (const r of data[c.key]) {
          required(
            typeof r.id === "string" &&
              /^[a-f0-9-]{36}$/.test(r.id) &&
              !ids.has(r.id),
            "Неверный или повторный ID.",
          );
          ids.add(r.id);
          required(
            typeof r.createdBy === "string" &&
              Number.isFinite(Date.parse(r.createdAt)) &&
              Number.isFinite(Date.parse(r.updatedAt)) &&
              typeof r.archived === "boolean",
            "Неверная история записи.",
          );
          cleanRow(c, r, data);
        }
      }
      this.definition.validate(data, data, { operation: "restore" }, actor);
      this.db
        .prepare("UPDATE workspace SET revision=1,payload=? WHERE id=1")
        .run(JSON.stringify(data));
      this.db
        .prepare("INSERT INTO audit VALUES(?,?,?,?)")
        .run(
          randomUUID(),
          new Date().toISOString(),
          actor.name,
          '{"operation":"restore_into_empty_database"}',
        );
      this.db.exec("COMMIT");
      return this.read();
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
}
