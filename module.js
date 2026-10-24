import {
  F,
  S,
  R,
  C,
  live,
  rows,
  byId,
  unique,
  required,
  minor,
  amount,
  interval,
  noOverlap,
  changed,
  immutable,
  admin,
  totalLines,
  summary,
  clock,
  label,
} from "./core/rules.js";
const definition = {
  slug: "ruleshelf",
  reference: 89,
  title: "RuleShelf",
  description:
    "Версии регламентов, сроки пересмотра и отметки ознакомления с конкретной версией.",
  limitations:
    "Одна организация · Собственный сервер · Ручной ввод · Без банковских и внешних интеграций",
  collections: [
    C(
      "policies",
      "Регламенты",
      [
        F("name", "Название"),
        F("owner", "Ответственный"),
        F("body", "Текст регламента", "textarea"),
        F("source", "Источник", "url"),
        F("version", "Версия", "integer", { min: 1, max: 100000 }),
        F("validUntil", "Пересмотреть до", "date"),
        S("status", "Состояние", [
          ["draft", "Черновик"],
          ["approved", "Одобрен"],
          ["retired", "Выведен"],
        ]),
      ],
      { writeRole: "admin" },
    ),
    C("acks", "Ознакомление", [
      R("policy", "Регламент", "policies"),
      F("person", "Обозначение сотрудника"),
      F("version", "Подтверждаемая версия", "integer", { min: 1, max: 100000 }),
      F("evidence", "Основание отметки", "textarea"),
    ]),
  ],
  validate(state, before, command, actor) {
    for (const p of rows(state, "policies")) {
      const old = changed(before, "policies", p.id);
      if (!old)
        required(
          p.status === "draft" && p.version === 1,
          "Новый регламент: черновик версии 1.",
        );
      if (old && old.body !== p.body)
        required(
          p.status === "draft" && p.version === old.version + 1,
          "Изменённый текст требует следующей версии и нового одобрения.",
        );
      if (old && old.body === p.body)
        required(
          p.version === old.version,
          "Номер версии меняется вместе с текстом.",
        );
      if (p.status === "approved" && old?.status !== "approved")
        required(
          p.validUntil >= new Date().toISOString().slice(0, 10),
          "Нельзя одобрить просроченный регламент.",
        );
    }
    for (const a of rows(state, "acks")) {
      const p = byId(state, "policies", a.policy),
        old = changed(before, "acks", a.id);
      if (!old)
        required(
          !p.archived && p.status === "approved" &&
            a.version === p.version &&
            p.validUntil >= new Date().toISOString().slice(0, 10),
          "Ознакомление возможно с действующей одобренной версией.",
        );
      if (old)
        immutable(old, a, [
          "policy",
          "person",
          "version",
          "evidence",
          "archived",
        ]);
    }
    unique(
      rows(state, "acks").map((a) => ({
        key: a.policy + ":" + a.person + ":" + a.version,
      })),
      "key",
      "Ознакомление",
    );
  },
  summarize(state) {
    return rows(state, "policies").map((p) =>
      summary(
        p.name +
          " · v" +
          p.version +
          " · " +
          label(definition, "policies", "status", p.status),
        "Пересмотреть до " + p.validUntil,
        ...rows(state, "acks")
          .filter((a) => a.policy === p.id)
          .map(
            (a) =>
              a.person +
              " ознакомлен с v" +
              a.version +
              (a.version === p.version ? "" : " · требуется новая отметка"),
          ),
      ),
    );
  },
};
export default definition;
