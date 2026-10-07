# New client setup

Start-to-running in under an hour. Follow these steps in order.

---

## Step 1 — Copy the folder

Duplicate the template directory and give it the client name. Do this at the filesystem level; there is no scaffold script.

```bash
cp -r "CRM template" "My Client CRM"
cd "My Client CRM"
```

---

## Step 2 — Register the new tenant in `src/lib/theme.js`

Open `src/lib/theme.js` and add an entry to the `TENANTS` object:

```js
export const TENANTS = {
  // …existing tenants…
  myclient: {
    key: 'myclient',            // must match the [data-tenant] block you add in Step 3
    name: 'My Client Name',
    mark: 'M',                  // 1–2 char sidebar glyph
    tagline: 'Tagline here.',
    industry: 'Describe the industry',
  },
}
```

Then set the active tenant (bottom of the same file):

```js
export const ACTIVE_TENANT_KEY = import.meta.env?.VITE_TENANT || 'myclient'
```

Or control it per-deploy via `.env.local` (see Step 6).

---

## Step 3 — Add a `[data-tenant]` block in `src/theme.css`

Append a CSS block that overrides only the tokens that differ from the default. At minimum, set accent colours and sidebar background. See `docs/THEMING.md` for the full token list and WCAG AA guidance.

```css
/* My Client — brief description of aesthetic */
[data-tenant='myclient'] {
  --bg: #f4f1ec;
  --surface: #fdfcfa;
  --ink: #1a1610;
  --muted: #6a6056;
  --line: #e0d9cf;
  --accent: #7b4fcf;
  --accent-ink: #5f39a3;
  --accent-soft: rgba(123, 79, 207, 0.1);
  --sidebar-bg: #1a1428;
  --sidebar-bg-2: #231c36;
}
```

---

## Step 4 — Rename entities, statuses, and pipeline stages in `src/lib/constants.js`

Open `src/lib/constants.js` and edit the vocabulary to match the client's domain. These cascade through every screen automatically.

```js
// Example: healthcare clinic
export const ENTITIES = {
  account: { singular: 'Department', plural: 'Departments' },
  contact: { singular: 'Clinician', plural: 'Clinicians' },
  record:  { singular: 'Patient',   plural: 'Patients'   },
  deal:    { singular: 'Referral',  plural: 'Referrals'  },
}

export const RECORD_STATUSES = [
  { value: 'new',      label: 'New',      tone: 'info'    },
  { value: 'active',   label: 'Active',   tone: 'accent'  },
  { value: 'on_hold',  label: 'On hold',  tone: 'pending' },
  { value: 'won',      label: 'Discharged', tone: 'confirmed' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
]

export const PIPELINE_STAGES = [
  { value: 'enquiry',    label: 'Enquiry',    tone: 'info'      },
  { value: 'assessment', label: 'Assessment', tone: 'pending'   },
  { value: 'approved',   label: 'Approved',   tone: 'confirmed' },
  { value: 'declined',   label: 'Declined',   tone: 'cancelled' },
]
```

Also update `NAV_GROUPS` labels in the same file if needed.

---

## Step 5 — Sync the enums in `supabase-setup.sql` and run it

The `check(...)` constraints in `supabase-setup.sql` must match the `value` fields in `RECORD_STATUSES` and `PIPELINE_STAGES`. Open the file and update the relevant constraints:

```sql
-- Example: update the deals stage check
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_check;
ALTER TABLE deals ADD CONSTRAINT deals_stage_check
  CHECK (stage IN ('enquiry', 'assessment', 'approved', 'declined'));
```

Then run the full SQL against your Supabase project. You can paste it into the Supabase SQL editor or use the CLI:

```bash
# Via CLI (replace project-ref)
supabase db push --project-ref <your-project-ref>

# Or connect directly
psql "postgresql://postgres:<password>@<host>:5432/postgres" -f supabase-setup.sql
```

---

## Step 6 — Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```dotenv
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# AI keys (server-side only — never prefix with VITE_)
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...

# Tenant branding (optional — overrides ACTIVE_TENANT_KEY in theme.js)
VITE_TENANT=myclient

# API server port (default: 8797)
API_PORT=8797
```

Keys without the `VITE_` prefix are server-side only (Express reads them). The browser never sees them.

---

## Step 7 — Install and start

```bash
npm install
npm run dev
```

This runs both the Vite dev server (default port 5173) and the Express API proxy (default port 8797) concurrently. Visit `http://localhost:5173`. Check the Style Guide page (`/app/style`) to confirm the API status badges show "Connected".

To run each server separately:

```bash
npm run web   # Vite only
npm run api   # Express only
```

---

## Step 8 — Seed a little data

Create a test account, a contact, and one pipeline deal via the UI. This confirms:

- Supabase is connected (rows save and reload).
- RLS policies allow inserts (check the Supabase dashboard → Auth → Policies if rows vanish).
- The AI assistant responds (send a message in `/app/assistant`).

---

## Step 9 — Run the ten-k Final Gate

Before any client handoff or deployment, run through the ten-k checklist Final Gate. Invoke it with `/ten-k-checklist` in Claude Code, or work through the checklist in `~/.claude/skills/ten-k-checklist/SKILL.md` manually.

Key checks for this template:

- [ ] Contrast passes WCAG AA on `--accent-ink` text against `--surface` and `--bg`.
- [ ] All pages render without console errors with Supabase disconnected.
- [ ] All pages render without console errors with no AI keys set (API returns `claude:false`).
- [ ] Mobile layout tested at 375px width (sidebar collapses, cards stack).
- [ ] Page titles are meaningful (`<title>` in `index.html` updated to client name).
- [ ] `.env.local` is in `.gitignore` and NOT committed.

---

## Quick reference

| What to change | File |
|---|---|
| Brand colours | `src/theme.css` — `[data-tenant='myclient']` |
| Tenant registry | `src/lib/theme.js` — `TENANTS` object |
| Entity / status / stage vocabulary | `src/lib/constants.js` |
| DB schema + enums | `supabase-setup.sql` |
| Env keys | `.env.local` (never committed) |
| Page `<title>` + fonts | `index.html` |
| Academy courses | `src/lib/academy.js` |
