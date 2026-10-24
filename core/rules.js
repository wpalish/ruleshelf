import {
  required,
  minor,
  amount,
  rows,
  byId,
  unique,
  interval,
  noOverlap,
} from "./store.js";
export { required, minor, amount, rows, byId, unique, interval, noOverlap };
export const F = (key, label, type = "text", more = {}) => ({
  key,
  label,
  type,
  ...more,
});
export const S = (key, label, options, more = {}) =>
  F(key, label, "select", {
    options: options.map((x) =>
      Array.isArray(x) ? { value: x[0], label: x[1] } : x,
    ),
    ...more,
  });
export const R = (key, label, ref, more = {}) =>
  F(key, label, "reference", { ref, ...more });
export const C = (key, title, fields, more = {}) => ({
  key,
  title,
  fields,
  ...more,
});
export const live = (state, key) => rows(state, key).filter((x) => !x.archived);
export const changed = (before, key, id) =>
  before ? rows(before, key).find((x) => x.id === id) : null;
export function immutable(
  old,
  row,
  keys,
  message = "Утверждённую запись нельзя менять. Создайте новую версию.",
) {
  if (old)
    for (const key of keys)
      required(JSON.stringify(old[key]) === JSON.stringify(row[key]), message);
}
export function admin(actor) {
  required(
    actor.role === "admin",
    "Это действие доступно только администратору.",
  );
}
export function totalLines(state, key, parentKey, parentId) {
  return rows(state, key)
    .filter((x) => x[parentKey] === parentId && !x.archived)
    .reduce((sum, x) => {
      const value = Math.round(Number(x.quantity) * minor(x.price));
      required(
        Number.isSafeInteger(value) && Number.isSafeInteger(sum + value),
        "Сумма слишком велика.",
      );
      return sum + value;
    }, 0);
}
export function currencyMatch(state, entries, parentCollection, parentKey) {
  for (const row of entries) {
    const parent = byId(state, parentCollection, row[parentKey]);
    required(
      row.currency === parent.currency,
      "Валюта не совпадает с документом.",
    );
  }
}
export function summary(title, ...lines) {
  return { title, lines };
}
export function clock(value, reference = value) {
  const zone = reference.match(/([+-])(\d\d):(\d\d)$/);
  const offset = zone
    ? (zone[1] === "-" ? -1 : 1) * (Number(zone[2]) * 60 + Number(zone[3]))
    : 0;
  return (
    new Date(Date.parse(value) + offset * 60000)
      .toISOString()
      .slice(0, 16)
      .replace("T", " ") + (zone ? " " + zone[0] : " UTC")
  );
}
export const status = S("status", "Статус", [
  ["draft", "Черновик"],
  ["approved", "Одобрен"],
]);

export function label(definition, collection, field, value) {
  const options =
    definition.collections
      .find((c) => c.key === collection)
      ?.fields.find((f) => f.key === field)?.options || [];
  const option = options.find(
    (x) => (typeof x === "string" ? x : x.value) === value,
  );
  return typeof option === "string" ? option : option?.label || String(value);
}
