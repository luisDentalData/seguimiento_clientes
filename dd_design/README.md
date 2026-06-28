# Dental Data — Frontend Kit

The Dental Data design language distilled for the DDBoss product app (React + Tailwind v4).
Brand voice: Spanish, editorial, data-forward. *Tú*, never *usted*. Sentence-case headlines.

## Install

1. Copy `frontend/` into your app (e.g. `src/dd/`).
2. In your main CSS entry, import Tailwind then this theme:

   ```css
   @import "tailwindcss";
   @import "./dd/theme.css";
   ```

3. Load the fonts in your `<head>` (do not @import them in CSS):

   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com" />
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
   <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
   <link href="https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300,0,0" rel="stylesheet" />
   ```

4. Import components:

   ```tsx
   import { Button, Card, Stat, Heading, Eyebrow } from "./dd/components";
   ```

## Light / dark

Light is the default. For dark, set `data-theme="dark"` on a parent (usually `<html>`):

```html
<html data-theme="dark">
```

Surface utilities (`bg-canvas`, `bg-surface`, `text-fg`, `text-fg-muted`, `border-line`) follow the active theme automatically.

## Token cheat-sheet

| Need | Utility |
|---|---|
| Page / card surface | `bg-canvas`, `bg-surface` |
| Text | `text-fg`, `text-fg-muted`, `text-fg-subtle` |
| Hairline border | `border border-line` |
| Brand color (DDBoss) | `bg-boss-primary`, `text-boss-primary`, `bg-boss-deep` |
| Action accent (orange) | `bg-accent`, `text-accent` |
| DDSchool | `bg-school-primary`, `bg-school-teal` |
| Display / body / mono font | `font-display`, `font-sans`, `font-mono` |
| Type sizes | `text-2xs`…`text-7xl` (11→120px — DD scale, **not** stock Tailwind) |
| Corners | `rounded-none` (default), `rounded-sm`/`md`/`lg`/`xl` (22px), `rounded-full` |
| Elevation | `shadow-sm`/`md`/`lg`, `shadow-glow-purple`/`-orange`/`-teal` (dark) |
| Gradients | `bg-degradado-1`, `bg-degradado-2`, `bg-gradient-purple`/`-teal`/`-orange` |
| Motion | `ease-standard`/`ease-emphasized`, `duration-fast`/`base`/`slow` |
| Spacing | stock Tailwind 4px scale: `p-1`=4px … `p-6`=24 … `p-24`=96px |
| Danger / error | `bg-danger`, `text-danger-fg`, `border-danger-fg`, `bg-danger-tint` |
| Success / positive | `bg-success`, `text-success`, `bg-success-tint` |

## The 5 brand rules that show up in code

1. **Sentence case** headlines. Title Case reads American/SaaS — off-brand.
2. **Italic keyword for emphasis**, rendered in the DDBoss brand purple (`text-boss-primary`) — `<Heading>Toma <em>el control</em></Heading>`. Never bold for emphasis. (The orange `text-accent` is for actions, not headline emphasis.)
3. **No emoji.** Use a Material Symbol or a stylised arrow (↗).
4. **Numbers earn their place** — set big in `font-display` (use `<Stat>`).
5. **Square corners by default.** Pills only for tags, status, and arrow-buttons.

## Iconography

Material Symbols Outlined only (never Sharp/Rounded/Filled), weight 300 on light / 200 on dark (handled by `theme.css`):

```html
<span class="material-symbols-outlined">analytics</span>
```

Curated set: dashboard, analytics, query_stats, groups, person, calendar_month, event, payments, trending_up, pie_chart, settings, tune, mail, notifications, check_circle, error, info, arrow_outward, chevron_right, expand_more.

## Components

**Primitives**
- `Heading` (level 1–3) + `Eyebrow`
- `Stat` (value + label, `accent`)
- `Badge` (plain | teal | purple | orange | outlined | status)
- `Card` (soft | hairline | inverse | data)
- `Button` (primary | accent | ghost | danger, `pill`, `loading`)

**Forms**
- `Input`, `Select`, `Textarea` — self-wrapping: pass `label` / `error` / `required` / `hint` directly (each renders its own `Field`). `error` flips the control to the danger border. Always pass `id` so the label binds to the control.
- `Field` — the label/error wrapper they use internally. Reach for it directly only to wrap a *custom* control; do not put it around Input/Select/Textarea (that double-wraps and duplicates the error).
- `Checkbox` — single checkbox with label; spreads all native `<input>` attrs.
- `RadioGroup` — label + options array + optional error.
- `MultiSelect` — searchable combobox with tag chips; full keyboard + ARIA.

**Data**
- `Table` + `THead` / `TBody` / `Tr` / `Th` / `Td` / `TableMessage` — composable, hairline editorial

**Feedback / overlay**
- `Alert` (error | info | success)
- `Spinner`, `Skeleton`
- `EmptyState`
- `Modal` + `ConfirmDialog` — accessible: Esc closes, focus trap, scroll lock

**Nav**
- `Nav` + `NavItem` — `NavItem` is polymorphic via `as` (e.g. router `Link`)
- `Tabs` — controlled tablist with arrow-key navigation; consumer renders the matching `role="tabpanel"`.

#### Badge for domain values

Map domain enums to Badge variants — no new component needed. E.g. `<Badge variant="teal">fixed</Badge>`, `<Badge variant="orange">variable</Badge>`.

### Example

```tsx
import { Input, Select, ConfirmDialog } from "./dd/components";

function PatientForm() {
  return (
    <form>
      <Input id="name" label="Name" placeholder="Ada Lovelace" required />

      <Select id="specialty" label="Specialty" error="Required">
        <option value="ortho">Orthodontics</option>
        <option value="perio">Periodontics</option>
      </Select>
    </form>
  );
}

function DeleteConfirm({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete patient?"
      message="This action cannot be undone."
      confirmLabel="Delete"
      danger
    />
  );
}
```
