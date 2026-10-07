// ============================================================
// PER-CLASS LINK PREVIEWS — prerender, run after `vite build`.
//
// THE PROBLEM THIS SOLVES
//
// /c/:slug is the shareable class link. The whole of flow-chart Step 3 is
// built on someone pasting one into the WhatsApp group. But this is a single
// page app: the only <meta> tags that exist are the ones in index.html, and
// they describe the CLUB. The per-page title is set by a React effect, and
// crawlers do not run JavaScript.
//
// So before this script existed, all twelve class links previewed as the same
// card — the same photo, the same "Made Running — No One Gets Left Behind",
// the same club blurb. A member sharing Hot Kettlebells and a member sharing
// Sunday's Propain HIIT produced identical-looking messages, and the one thing
// a preview has to do is say which class it is.
//
// HOW IT WORKS
//
// After Vite has written dist/index.html, this walks the club's timetable and
// writes dist/c/<slug>/index.html for each class — the same document, byte for
// byte, with the club's meta tags swapped for that class's. Vercel checks the
// filesystem BEFORE it applies the rewrites in vercel.json, so a request for
// /c/hot-kettlebells-mon-0930 is served this file instead of falling through
// the /((?!api/).*) catch-all to the generic index.html.
//
// Every file still loads the identical bundle, so React boots and takes over
// exactly as before. The prerendered HTML is for the crawler; the member gets
// the same app they always did. Nothing here is a second rendering path that
// could disagree with the page.
//
// WHY IT READS THE APP'S OWN MODULES
//
// It loads src/lib/hubClasses.js through Vite rather than re-declaring the
// timetable, so a class that is renamed, re-timed or handed to a new coach
// changes its link preview on the next build with nothing here to update.
// Duplicating the twelve classes into this file would have been simpler and
// would have quietly gone stale — which is the exact failure the dynamic-name
// rule in this codebase exists to prevent.
// ============================================================
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')

// ── Escaping, which is load-bearing and not hygiene ────────────────
// "K3 & Marvin" coaches both Valley sessions. Dropped into a content="..."
// unescaped, the ampersand starts an entity reference and the tag is invalid
// on two of the twelve pages — and those are the two the club shares most.
// Quotes matter for the same reason: a class called CaTcH a Circuit is fine
// today, but the club renames classes and one apostrophe-heavy name would
// otherwise break out of the attribute.
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Replacing a meta tag by its identifying attribute ──────────────
// Matched on property="og:title" / name="twitter:title" rather than on the
// whole tag text, so this keeps working when the club edits the wording in
// index.html — which they will, because index.html is the one file in here
// that reads like marketing copy.
//
// Returns the html UNCHANGED if the tag is not found, and the caller counts
// those. A silent no-op here would ship twelve pages that all still say
// "No One Gets Left Behind" and look, from the outside, exactly like a
// successful build.
function setMeta(html, attr, key, value) {
  const re = new RegExp(
    `(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`,
    'i',
  )
  return re.test(html) ? html.replace(re, `$1${esc(value)}$2`) : null
}

function setTitle(html, value) {
  const re = /(<title>)[^<]*(<\/title>)/i
  return re.test(html) ? html.replace(re, `$1${esc(value)}$2`) : null
}

async function main() {
  // middlewareMode + appType:'custom' so no HTTP port is opened — this is a
  // build step, not a dev server, and a build that binds a port fails in CI
  // the first time two of them overlap.
  const vite = await createServer({
    root: ROOT,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })

  let written = 0
  try {
    const { HUB_CLASSES, classCopy } = await vite.ssrLoadModule(
      '/src/lib/hubClasses.js',
    )
    // dayLabel and fmtTime, from the same module the page formats with, so
    // "9.30am" in the preview and "9.30am" on the page cannot diverge into
    // "09:30".
    const { dayLabel, fmtTime } = await vite.ssrLoadModule('/src/lib/classes.js')

    const shell = await readFile(join(DIST, 'index.html'), 'utf8')

    // ── The origin is READ, not written here ──
    // index.html's og:url is the club's canonical address and this script has
    // no business deciding what that is. Taking it from the shell means
    // pointing the site at a new domain is still a one-line change in one
    // file, and a preview can never advertise an origin the rest of the site
    // disagrees with.
    //
    // SITE_ORIGIN overrides it for the case where the two legitimately differ
    // — a staging deployment, or a domain that is registered but not yet
    // serving. It is an override and not the default on purpose: a build with
    // no environment set must still produce the club's real address rather
    // than whatever host happened to run it.
    const origin = (
      process.env.SITE_ORIGIN ||
      shell.match(/<meta\s+property="og:url"\s+content="([^"]+)"/i)?.[1] ||
      ''
    ).replace(/\/+$/, '')
    if (!origin) throw new Error('No og:url in dist/index.html to derive the origin from')

    for (const hub of HUB_CLASSES) {
      const when = `${dayLabel(hub.day)}s ${fmtTime(hub.time)}`

      // ── The title carries the class AND the time ──
      // og:site_name is already "Made Running", and WhatsApp renders it above
      // the title, so "Hot Kettlebells — Made Running" would say the club
      // twice and the class once. The slot is better spent on when it runs:
      // three of these twelve names appear more than once on the timetable
      // (two Hot Kettlebells, two Valley sessions), and the time is the only
      // thing that tells a member WHICH one they have just been sent.
      const title = `${hub.title} · ${when}`

      // The coach first, because that is what a member scans for, then the
      // same corroborated placeholder the page itself shows — see classCopy(),
      // which refuses to print discipline-specific copy that the class name
      // does not back up. The preview inherits that safeguard rather than
      // getting its own looser version of it.
      const lead = hub.coach ? `With ${hub.coach}. ` : ''
      const body = classCopy(hub) || ''
      // Trimmed to about the two lines WhatsApp and Facebook actually render.
      // Cut on a word boundary with an ellipsis, never mid-word, because a
      // preview ending "bring water and a to" reads as a broken page.
      const full = `${lead}${body}`.trim()
      const description =
        full.length <= 180
          ? full
          : `${full.slice(0, 180).replace(/\s+\S*$/, '')}…`

      const url = `${origin}/c/${hub.dbSlug}`

      let html = shell
      const edits = [
        ['title', null, title],
        ['meta', ['property', 'og:title'], title],
        ['meta', ['property', 'og:description'], description],
        ['meta', ['property', 'og:url'], url],
        ['meta', ['name', 'description'], description],
        ['meta', ['name', 'twitter:title'], title],
        ['meta', ['name', 'twitter:description'], description],
      ]
      for (const [kind, sel, value] of edits) {
        const next =
          kind === 'title' ? setTitle(html, value) : setMeta(html, sel[0], sel[1], value)
        // Loud, and fails the build. A link preview that silently kept the
        // club's generic card is invisible from the terminal and invisible on
        // the deployed site — you only find out when someone shares a class
        // and the wrong thing appears in the group chat.
        if (next === null) {
          throw new Error(
            `dist/index.html has no ${sel ? `${sel[0]}="${sel[1]}"` : '<title>'} ` +
            'to replace. If it was renamed in index.html, update the edits list ' +
            'in scripts/prerender-classes.mjs to match.',
          )
        }
        html = next
      }

      // ── og:image is deliberately NOT per-class ──
      // The club's card is a real 1200x630 photograph of the club. The only
      // per-class artwork that exists is the discipline band, briefed at
      // 660x180 (src/assets/classes/README.md) — an 11:3 strip, which WhatsApp
      // and Facebook would letterbox into a 1.91:1 slot with two grey bars.
      // A correct photo of the wrong shape previews worse than the right photo
      // of the club, so the image stays and the words do the identifying.
      //
      // The day the club exports 1200x630 class cards this is where they go.

      const dir = join(DIST, 'c', hub.dbSlug)
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'index.html'), html, 'utf8')
      written += 1
    }
  } finally {
    // In a finally, so a throw above still releases Vite's watchers and the
    // build exits instead of hanging with a non-obvious cause.
    await vite.close()
  }

  // eslint-disable-next-line no-console
  console.log(`[prerender] ${written} class link previews written to dist/c/`)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[prerender] failed:', err.message)
  // Non-zero, so a broken prerender fails `npm run build` rather than
  // shipping twelve identical previews.
  process.exit(1)
})
