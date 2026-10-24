---
name: "RuleShelf"
description: "Версии регламентов, сроки пересмотра и отметки ознакомления с конкретной версией."
colors:
  primary: "#126653"
  primary-hover: "#0b5343"
  navy: "#183e60"
  ink: "#172e45"
  page-ground: "#edf3f8"
  surface: "#fff"
  navigation-ground: "#dce9f3"
  line: "#b9cbd9"
  input-border: "#7894aa"
  muted: "#46627a"
  link: "#174e7e"
  pending: "#795200"
  error: "#942721"
  error-ground: "#fff0ee"
  selection-ground: "#b7ded2"
  selection-ink: "#132f29"
  focus: "#bd671a"
typography:
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "clamp(1.7rem, 4vw, 2.5rem)"
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1.3rem"
  brand:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1.4rem"
    fontWeight: 740
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    lineHeight: 1.6
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontWeight: 600
  muted:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.9rem"
  entry-title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1rem"
  audit-code:
    fontSize: "0.85rem"
  status:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontWeight: 650
rounded:
  control: "7px"
  surface: "12px"
spacing:
  tight: "0.5rem"
  action-gap: "0.6rem"
  field-inset: "0.7rem"
  table-inset: "0.9rem"
  base: "1rem"
  page-gutter: "1.25rem"
  panel: "1.4rem"
  section: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0.65rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.navy}"
    rounded: "{rounded.control}"
    padding: "0.65rem 1rem"
  button-default:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0.65rem 1rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "{spacing.field-inset}"
    width: "100%"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "{spacing.panel}"
  table-heading:
    backgroundColor: "{colors.navigation-ground}"
    textColor: "{colors.ink}"
    padding: "{spacing.table-inset}"
  error-notice:
    backgroundColor: "{colors.error-ground}"
    textColor: "{colors.error}"
    rounded: "{rounded.control}"
    padding: "{spacing.base}"
---

# Design System: RuleShelf

## Overview

**Creative North Star: "Public reference register"**

RuleShelf uses the inherited public reference register: a cool pale-blue ground, navy shell, ink text, restrained teal actions and white reading surfaces. It is a practical Russian-language workspace for one organization, with familiar labelled fields, readable records and computed controls. The code and the existing surface contract define this identity; this document does not assign a new identity to the product.

The same shell serves «Регламенты», «Ознакомление». Domain vocabulary comes from module.js, while the reusable visual system comes from public/styles.css, public/app.js and public/index.html. The system remains flat and task-focused; saved records and server-calculated results share a workflow.

**Key Characteristics:**
- Cool ground and white reading surfaces with navy structure.
- Teal primary actions, labelled native controls and visible keyboard focus.
- Ruled record tables with contained horizontal scrolling on narrow screens.
- Russian domain labels and explicit distinction between saved records and calculated results.

Evidence and provenance: this is a scan of the completed code-led build, not a comp specification. [PRODUCT.md](PRODUCT.md), [README.md](README.md) and the [surface contract](.impeccable/surface.md) bound the workflow. The contract records inheritance from DerekDesk with seed:3c78d412b26a4ca6; the earlier DerekDesk review reportedly corroborated it, but the current seed record is unavailable. No new roll or current seed validation is claimed. No approved comp or QUALITY BAR card was supplied; the quality ceiling remains unscored.

The [finish review](.impeccable/review/finish-review.md) and [verdict pass](.impeccable/review/verdict-pass.md) record the independent review. The latter says ship for its scored fixes only. This documentation does not widen that verdict to every state, backend security or production readiness.

## Colors

The frontmatter is the normative palette. The visual character is cool and restrained; the primary accent marks work to perform, while navy anchors the shell.

### Primary

- **Restrained teal** (`primary`): primary task actions and all submit controls; deep teal (`primary-hover`) is their hover background. The shared button hover filter also remains applied.
- **Navy shell** (`navy`): header, base buttons, secondary text and structural accents. It does not replace the committed teal task hierarchy.

### Neutral

- **Register ink**, **pale blue ground** and **white reading surface** (`ink`, `page-ground`, `surface`): text, page and content surfaces.
- **Blue navigation wash**, **ruled divider** and **field boundary** (`navigation-ground`, `line`, `input-border`): navigation/table headers, separators and native field edges.
- **Muted blue ink** and **linked blue** (`muted`, `link`): supporting text and links/caret.
- **Pending amber**, **error red / wash**, **selection mint / ink** and **keyboard focus amber** (`pending`, `error`, `error-ground`, `selection-ground`, `selection-ink`, `focus`): existing semantic selectors, selection and keyboard feedback. Status/error classes are capabilities in shared CSS; the general renderer does not color every enum value automatically.

**The Action hierarchy Rule.** Use teal for primary task and submit actions; retain the white secondary action treatment and navy shell.

Calculated sRGB contrast for the literal source colors: white on teal 6.88:1; white on navy 11.07:1; body ink on the page ground 12.41:1; muted ink on the page ground 5.71:1; field boundary against white 3.17:1; focus against white 4.10:1 and against the page ground 3.67:1; error text on its wash 7.37:1. These are static pair calculations, not a complete accessibility audit. The faint divider against white is 1.67:1 and is not the sole boundary for text fields. Disabled opacity and the combined hover filter are not covered by those base-color ratios.

## Typography

The source uses one platform system UI stack (`typography.body.fontFamily`) with font synthesis disabled. It inherits browser base text sizing; a typical default is 16px, rather than a separately declared project body-size token. System UI is recorded as the inherited Operate control/body choice, not a general display-face prescription.

- **Task headline:** fluid `headline`, with tight line height and slightly negative tracking; applied to h1.
- **Section title:** `title` on h2; default browser heading weight is retained.
- **Brand:** `brand`, with the explicit heavier source weight.
- **Body:** paragraphs use the `body` line height and a maximum measure of 72ch.
- **Labels/actions:** `label` weight; fields and buttons inherit surrounding type.
- **Supporting / audit text:** `muted` and `audit-code`; small text has line height 1.5.
- **Record numbers:** table and date inputs use tabular numerals.

No external font asset or custom font loading exists in the inspected page. h1/h2/h3 boldness otherwise follows browser defaults.

## Layout

The centered main region is bounded at 1200px with base gutters of 1.25rem and vertical padding of 2rem. Header/navigation align their content with `max(1.25rem, calc((100% - 1160px) / 2))`. Header and action groups use flex layout; actions wrap. The login panel is capped at 480px. The shared stylesheet defines a two-column work utility (1fr / 0.8fr with a 260px lower bound) and a two-column row utility, but the current collection renderer does not instantiate those utility classes.

Search uses a minmax(200px, 500px) field plus archive control. Tables span their container, show the first five schema fields plus an action column, use collapsed borders and 0.9rem cell padding, and allow long content to wrap within a 28ch cell maximum. The white table wrapper owns horizontal overflow; it is keyboard focusable and has an accessible scroll label.

At 700px and below, work/row utilities stack, main/panel padding reduces, the header identity text becomes smaller, and navigation wraps. At 600px and below, search stacks, table text reduces, cells have a 140px minimum width, and the table-scroll hint appears. Wide tables remain inside their own scroll region. There is no separate mobile shell or bottom navigation.

**The Readable records Rule.** Keep the domain labels, record table and computed results in one reading order; contain wide tables in their focusable scroll region.

Existing reviewed capture set (actual JPEG dimensions checked during documentation):

| Capture | Dimensions | Evidence scope |
| --- | --- | --- |
| [desktop.jpg](.impeccable/review/desktop.jpg) | 1440 × 900 | Existing captured collection state; see review limitations. |
| [mobile.jpg](.impeccable/review/mobile.jpg) | 390 × 1062 | Existing captured collection state; see review limitations. |
| [user-1280.jpg](.impeccable/review/user-1280.jpg) | 1280 × 900 | Existing captured collection state; see review limitations. |

The independent review describes those rendered collection states. This documenter inspected shared source and capture metadata; it did not execute a new browser run. Hover, disabled/loading, error, empty, login, edit, public and settings behavior below is code-derived unless a review explicitly says otherwise.

## Elevation & Depth

The system is flat. No box-shadow, text-shadow, backdrop filter, gradient, transition or animation is declared in the inspected stylesheet. Depth comes from white surfaces, blue washes, rules and outline feedback. Hover uses a brightness filter; focus uses a solid outline. The sidecar therefore records no invented shadow or motion scale.

## Shapes

Controls/notices use the gently rounded `control` radius; panels/table wrappers use the larger `surface` radius. Panels and table wrappers use a 1px divider border; input edges use the stronger field-boundary color. Buttons have a 44px minimum height. Textareas have a 100px minimum height and vertical resize. No glyph-based decoration, pill-tag family, imagery or decorative asset vocabulary appears in this shell.

## Components

### Buttons

Primary task buttons and submit buttons use teal with white text. A standard button otherwise starts navy; the shared button helper defaults to the white secondary variant. Controls use 0.65rem by 1rem padding and the control radius. Primary hover assigns deep teal and the generic hover selector applies brightness(1.13); secondary hover retains its own background plus the filter. Disabled buttons use opacity 0.55 and a wait cursor while the async wrapper is pending. No authored active transform or transition exists.

### Inputs / Fields

Visible associated labels precede full-width native inputs, selects and textareas. Fields use 0.7rem padding, a 1px field boundary and white fill. Focus-visible uses a 3px outline with a 3px offset on every focusable element. Required fields preserve native browser validity; server failures populate the shared error notice and move focus to it. Archived records or role restrictions disable saving; configured read-only fields preserve source values.

**The Labelled controls Rule.** Keep visible labels associated with every field, preserve native input types, and retain the visible focus outline.

### Navigation

The navy header holds the product brand and current identity. The navigation wash holds collection buttons, Data/access and Logout. The helper renders white secondary buttons; aria-current=page adds the selected divider border. Navigation wraps on mobile. The skip link moves from above the viewport into view on focus.

### Panels, records and notices

The white panel is used for login/edit forms and restore previews. Records use a ruled semantic table inside the scroll wrapper; Open is a secondary action. Summaries remain plain text sections under “Расчёт и контроль”, using entry headings and dividers. Empty/no-match records produce a muted explanation; an empty computation produces a muted prompt. The polite status notice is hidden when empty, white when populated, and error-colored when the error class is set. There is no modal or toast system.

### RuleShelf domain vocabulary

The product’s distinctness is its real schema and workflow, while the visual vocabulary remains shared.

| Collection | Labelled schema fields | Access / surface flag |
| --- | --- | --- |
| Регламенты (`policies`) | Название (text); Ответственный (text); Текст регламента (textarea); Источник (url); Версия (integer); Пересмотреть до (date); Состояние (select) | Admin write |
| Ознакомление (`acks`) | Регламент (reference); Обозначение сотрудника (text); Подтверждаемая версия (integer); Основание отметки (textarea) | Shared workspace controls |

Select values displayed in this product:

- **Регламенты / Состояние:** Черновик · Одобрен · Выведен.

- Reference selects show the related collection’s label field (or first field), exclude archived choices and display the resolved name in records. Search indexes those display values as well as stored content.
- Calendar dates use native date inputs and remain dates without a timezone.
- Numeric fields use native number inputs, integer step 1 or decimal step 0.01, and the limits defined by the field schema.

No collection in this product enables public links; the shared client’s public-form renderer is not a product-specific visual surface here.

### Data and access

The shared settings screen gives administrators data-copy download, file selection, a restore preview, employee creation and an expandable audit log. Operators see explanatory access copy. Restore is explicitly for an empty database. These controls reuse the same labels, panels and buttons; they do not imply a separate visual world or a security certification. Login retains username/password autocomplete and a teal submit control.

## Do's and Don'ts

### Do:

- **Do** reuse the shared palette and control vocabulary across collections.
- **Do** keep Russian display labels and resolved reference names readable and searchable.
- **Do** preserve the mobile table hint, focusable scroll container and wrapped prose.
- **Do** distinguish public form submission, manual status marks and server calculations using the existing product wording.

### Don't:

- **Don't** invent a separate palette or visual identity for each domain collection.
- **Don't** replace labelled fields with placeholder-only controls or hide keyboard focus.
- **Don't** turn a manual status mark into a claim of payment, signature, message delivery or external verification.
- **Don't** promote preview tonal ramps or unpictured states into browser-verified implementation facts.

Not canonized or repaired: the existing QUALITY BAR/seed-record evidence gaps, unpictured states and legacy PRODUCT.md schema remain explicit limits. No source, product brief, review or test was changed by this documentation pass.
