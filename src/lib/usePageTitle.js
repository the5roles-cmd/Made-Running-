// usePageTitle — one-line per-page <title> (QA, Oct 2026: every public page
// shared the homepage's tab title, so five open tabs were indistinguishable
// and search results would all carry the same headline).
//
// BookGym, ClassPage, Coaches and ManageBooking already set document.title by
// hand because their titles are dynamic (class name, booking state). This hook
// is for the pages with a STATIC name — Login, Join, ChoosePath, Privacy,
// ResetPassword, NotFound — so none of them re-implements the save/restore
// dance. The restore on unmount matters in an SPA: without it, navigating
// from /privacy back to the homepage would leave "Privacy — Made Running" on
// a page that is no longer the privacy page.
import { useEffect } from 'react'
import { tenant } from './theme'

export default function usePageTitle(title) {
  useEffect(() => {
    if (!title) return undefined
    const prev = document.title
    document.title = `${title} — ${tenant.name}`
    return () => {
      document.title = prev
    }
  }, [title])
}
