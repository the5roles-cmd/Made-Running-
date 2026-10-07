// ── The club's real wordmark, everywhere a lockup renders ──────────────────
//
// One component instead of ten hand-edited headers. Every surface that used
// to show the text lockup (<span class="…__mark">M</span> Made Running) now
// renders <BrandLogo> and passes its OLD markup as children:
//
//   <BrandLogo on="dark" height={22}>
//     <span className="sidebar__mark">{tenant.mark}</span>
//     <span>{tenant.name}</span>
//   </BrandLogo>
//
// If the active tenant has logo art (theme.js: logoOnLight / logoOnDark),
// the image renders. If it does not — every other tenant in the template —
// the children render exactly as they always did. That keeps this a
// re-skinnable template: a new client gets their logo by adding two PNGs
// and two lines in theme.js, never by touching the headers again.
//
// `on` names the SURFACE the logo sits on, not the logo's own colour:
// on="dark" → the white logo file, on="light" → the black one. Call sites
// know their own background; this component should not guess.
//
// width/height are both stated from the known ratio so the box is reserved
// before the PNG arrives — zero layout shift on slow connections, which is
// exactly where a logo swap is most visible.
import { tenant } from '../lib/theme'

export default function BrandLogo({ on = 'light', height = 22, alt, className, children }) {
  const src = on === 'dark' ? tenant.logoOnDark : tenant.logoOnLight
  if (!src) return children || null
  const ratio = tenant.logoRatio || 3
  return (
    <img
      src={src}
      // Default alt is the club's name; pass alt="" when the wrapping link
      // already carries an aria-label, so screen readers hear one name, not
      // two.
      alt={alt ?? tenant.name}
      className={className}
      height={height}
      width={Math.round(height * ratio)}
      style={{ display: 'block', height, width: 'auto' }}
      draggable={false}
    />
  )
}
