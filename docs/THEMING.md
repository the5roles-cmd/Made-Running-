# Theming

This template re-skins through a single CSS file and a single JS file. No component logic changes. A complete re-skin takes about 20 minutes.

---

## How it works

### 1. Design tokens in `src/theme.css`

All visual values live as CSS custom properties on `:root`. The default tenant also sets these under `[data-tenant='default']` so the selectors are consistent.

```css
:root,
[data-tenant='default'] {
  --accent: #12857a;
  --accent-ink: #0c655c;
  /* …etc */
}
```

Each additional client is **one `[data-tenant]` block** that overrides only the tokens that differ. You do not need to re-declare every token — inheritance handles the rest.

### 2. The two-tone accent rule

Every theme has exactly two accent tokens:

| Token | Purpose |
|---|---|
| `--accent` | Fills, backgrounds, icon containers, active bars |
| `--accent-ink` | Text and icon colour on *light* backgrounds (links, eyebrows, stat values) |

**WCAG AA requirement:** `--accent-ink` must achieve at least 4.5:1 contrast against `--bg` and `--surface`. Use a tool like [Colour Contrast Checker](https://webaim.org/resources/contrastchecker/) or [Polypane](https://polypane.app) to verify before shipping.

`--accent-contrast` (default: `#ffffff`) is used for text drawn *on top of* an `--accent` fill (e.g. primary buttons, avatar chips). Adjust this if your accent is light.

### 3. Adding a new `[data-tenant]` block

Copy the template below into `src/theme.css` and adjust the values. The minimal override is accent colours + sidebar background:

```css
/* My New Client — describe the aesthetic briefly */
[data-tenant='my-client'] {
  /* Canvas */
  --bg: #f4f1ec;
  --bg-2: #ece8e0;
  --surface: #fdfcfa;
  --surface-2: #f5f2ec;

  /* Ink */
  --ink: #1a1610;
  --muted: #6a6056;
  --line: #e0d9cf;

  /* Accent (VERIFY WCAG AA before shipping) */
  --accent: #7b4fcf;
  --accent-ink: #5f39a3;
  --accent-soft: rgba(123, 79, 207, 0.1);

  /* Sidebar */
  --sidebar-bg: #1a1428;
  --sidebar-bg-2: #231c36;
}
```

You may also override `--font-display` for a distinct editorial voice:

```css
--font-display: 'Playfair Display', Georgia, serif;
```

---

## How the active tenant is selected

`src/lib/theme.js` reads the env variable `VITE_TENANT` at build time (Vite inlines it), falling back to the `ACTIVE_TENANT_KEY` constant:

```js
export const ACTIVE_TENANT_KEY = import.meta.env?.VITE_TENANT || 'default'
export const tenant = TENANTS[ACTIVE_TENANT_KEY] || TENANTS.default
```

On mount, `applyTenant()` sets `<html data-tenant="...">`. The CSS selectors activate automatically.

**To switch tenant at runtime (dev):** change `VITE_TENANT=my-client` in `.env.local` and restart `npm run dev`. The entire visual system updates — no code changes.

---

## 20-minute re-skin checklist

Complete these steps in order. Each takes 2–4 minutes.

1. **Pick your accent.** Choose a single mid-tone colour. Derive `--accent-ink` by darkening ~15–25% and verifying WCAG AA (4.5:1) against `--surface` (#ffffff-ish). Derive `--accent-soft` as the accent at 10% opacity.

2. **Add a `[data-tenant]` block** in `src/theme.css` with your accent, canvas colours, ink, line, and sidebar background.

3. **Register the tenant** in `src/lib/theme.js` — add an entry to `TENANTS` with `key`, `name`, `mark`, `tagline`, `industry`.

4. **Set `VITE_TENANT`** in `.env.local` to your new key. Restart the dev server.

5. **Check contrast** on the Style Guide page (`/app/style`). The swatch section reads live token values. Confirm `--accent-ink` text looks readable on `--surface` and `--bg`.

6. **Spot-check the sidebar** — dark backgrounds need `--sidebar-text` and `--sidebar-text-active` to be legible. The defaults (`#b8b2a6` / `#ffffff`) usually work unless your sidebar is very light.

7. **Optional: swap the display font.** Add a Google Fonts `<link>` to `index.html` and set `--font-display` in your tenant block. The display font is used for headings, KPI numbers, and the `.display` class only.

8. **Run the Final Gate** (ten-k checklist) before handoff.

---

## File reference

| File | Role |
|---|---|
| `src/theme.css` | All token definitions; one `[data-tenant]` block per client |
| `src/lib/theme.js` | `TENANTS` registry; `ACTIVE_TENANT_KEY`; `applyTenant()` |
| `src/app.css` | Component styles (buttons, cards, grid, badges) — do not edit per tenant |
| `index.html` | Font `<link>` tags live here |
