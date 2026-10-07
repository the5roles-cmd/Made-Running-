// ============================================================
// BrandMarks — third-party logos, drawn not fetched
// ============================================================
// lucide-react ships no brand icons, by policy: brand marks are trademarks
// with usage rules, not generic UI glyphs, so an icon set cannot safely carry
// them. These are hand-traced paths matching each brand's published mark.
//
// Extracted here from ShareRow so the landing page's footer link and the
// share row use the SAME glyph. The alternative was pasting a 1.4 KB path
// into a second file, and two copies of a trademarked outline drift: one
// gets updated when a brand refreshes its logo and the other does not, and
// nobody notices because they are never on screen together.
//
// `size` rather than hard-coded width/height — the share row wants 17px
// inline with a label, the footer wants 18px centred in a 44px touch target.

export function InstagramMark({ size = 17, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      // Decorative in every current use: each call site already supplies an
      // accessible name on the control that wraps it (aria-label on the
      // footer link, a visible <span> label in the share row). An alt text
      // here would make screen readers announce "Instagram" twice.
      aria-hidden="true"
      {...props}
    >
      <path d="M12 2c2.72 0 3.06.01 4.12.06 1.07.05 1.79.22 2.43.47.66.25 1.22.6 1.77 1.15.55.55.9 1.11 1.15 1.77.25.64.42 1.36.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.07-.22 1.79-.47 2.43-.25.66-.6 1.22-1.15 1.77-.55.55-1.11.9-1.77 1.15-.64.25-1.36.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.07-.05-1.79-.22-2.43-.47a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.25-.64-.42-1.36-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.07.22-1.79.47-2.43.25-.66.6-1.22 1.15-1.77A4.9 4.9 0 0 1 5.45 2.53c.64-.25 1.36-.42 2.43-.47C8.94 2.01 9.28 2 12 2Zm0 1.8c-2.67 0-2.99.01-4.04.06-.82.04-1.27.17-1.56.29-.4.15-.68.34-.98.64-.3.3-.49.58-.64.98-.12.29-.25.74-.29 1.56-.05 1.05-.06 1.37-.06 4.04s.01 2.99.06 4.04c.04.82.17 1.27.29 1.56.15.4.34.68.64.98.3.3.58.49.98.64.29.12.74.25 1.56.29 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.82-.04 1.27-.17 1.56-.29.4-.15.68-.34.98-.64.3-.3.49-.58.64-.98.12-.29.25-.74.29-1.56.05-1.05.06-1.37.06-4.04s-.01-2.99-.06-4.04c-.04-.82-.17-1.27-.29-1.56-.15-.4-.34-.68-.64-.98-.3-.3-.58-.49-.98-.64-.29-.12-.74-.25-1.56-.29-1.05-.05-1.37-.06-4.04-.06Zm0 3.06a5.14 5.14 0 1 1 0 10.28 5.14 5.14 0 0 1 0-10.28Zm0 1.8a3.34 3.34 0 1 0 0 6.68 3.34 3.34 0 0 0 0-6.68Zm5.34-3.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
    </svg>
  )
}
