import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import RequireAuth from './auth/RequireAuth'
import RequireStaff from './auth/RequireStaff'
import RequireClassManager from './auth/RequireClassManager'
import Layout from './components/Layout'

// ── Public routes: eager ─────────────────────────────────────────────
// These are the four doors into the product. Nobody should watch a
// spinner to read the pitch page, so they ship in the main chunk.
import Landing from './pages/Landing'
import Login from './pages/Login'
import JoinRunner from './pages/JoinRunner'
import BookGym from './pages/BookGym'
import ManageBooking from './pages/ManageBooking'
import ChoosePath from './pages/ChoosePath'
import ResetPassword from './pages/ResetPassword'

// ── App routes: lazy ─────────────────────────────────────────────────
// Everything below sits behind RequireAuth, so a first-time visitor on
// the landing page can never need it. Loading it eagerly meant the
// public page paid for recharts (101 kB gzip) and the whole CRM surface
// before it painted. Splitting here means / loads the landing and
// nothing else; the app chunks fetch on the way through /login.
const Profile = lazy(() => import('./pages/Profile'))
const Sessions = lazy(() => import('./pages/Sessions'))
const SessionDetail = lazy(() => import('./pages/SessionDetail'))
const Gym = lazy(() => import('./pages/Gym'))
const MyRuns = lazy(() => import('./pages/MyRuns'))
const Volunteers = lazy(() => import('./pages/Volunteers'))
const Records = lazy(() => import('./pages/Records'))
const RecordDetail = lazy(() => import('./pages/RecordDetail'))
const Academy = lazy(() => import('./pages/Academy'))
const Course = lazy(() => import('./pages/Course'))
const Events = lazy(() => import('./pages/Events'))
const Shop = lazy(() => import('./pages/Shop'))
const Settings = lazy(() => import('./pages/Settings'))
const Community = lazy(() => import('./pages/Community'))
const AddFriend = lazy(() => import('./pages/AddFriend'))
// Class booking · Step 1a. Lazy like every other in-app screen: a member who
// can never open it should not download it.
const Classes = lazy(() => import('./pages/Classes'))

// ── Class booking · Step 3 ───────────────────────────────────────────
// The PUBLIC class page. Lazy even though it is public, which makes it the
// one exception to the "public routes ship eagerly" rule above — and it needs
// its own Suspense boundary, for a reason worth stating.
//
// The eager rule exists so nobody waits on a spinner to read the pitch page.
// This page is not the pitch page: it is only ever arrived at from a shared
// link, so a visitor to / must never pay for it. Loading it eagerly would put
// it in the main chunk that the landing page downloads before first paint.
//
// The boundary below is NOT optional. The only Suspense in this app lives in
// Layout.jsx around <Outlet />, which covers the /app routes. A lazy route out
// here would suspend with no fallback in scope and React would throw rather
// than wait — a blank page on the one URL the whole club is sent to.
const ClassPage = lazy(() => import('./pages/ClassPage'))

// Section 3b · The dedicated "Made Running Coaches" page. Public and lazy for
// the same two reasons as ClassPage above, and it needs its own Suspense
// boundary for the same third one.
const Coaches = lazy(() => import('./pages/Coaches'))

// Shared fallback for the two public lazy routes. Inline styles, NOT a
// className — each page ships its own CSS in a <style> tag inside its own
// chunk, so while that chunk is in flight none of its rules exist yet and a
// className would render an unstyled white flash at exactly the moment this is
// meant to cover.
function PublicBoot() {
  return (
    <div
      aria-busy="true"
      style={{ minHeight: '100vh', background: 'var(--bg, #f3efe8)' }}
    />
  )
}

// Deleted with the business surface: Accounts, AccountDetail, Contacts,
// ContactDetail, Pipeline, BusinessDashboard, Chapters, Outreach, Sales,
// Assistant, StyleGuide. Their tables remain in Supabase — see the note in
// constants.js. Records/RecordDetail are the exception and stay: a runner's
// own detail page belongs to the community side, and it is still staff-gated.

// The Suspense boundary for these lazy routes lives in Layout.jsx, wrapped
// around <Outlet /> — that keeps the sidebar and topbar on screen while a
// chunk arrives instead of blanking the whole shell.

export default function App() {
  return (
    <Routes>
      {/* Public. /start is the pre-login gate that routes people to the
          correct door: runners to /join (no auth), coaches to /login. */}
      <Route path="/" element={<Landing />} />
      <Route path="/start" element={<ChoosePath />} />
      <Route path="/login" element={<Login />} />
      <Route path="/join" element={<JoinRunner />} />
      {/* Public gym-class booking + Stripe checkout. No auth: books via
          SECURITY DEFINER RPCs resolved from the tenant slug. */}
      <Route path="/book" element={<BookGym />} />
      {/* ── Class booking · Step 11: the guest's own booking ──────────
          PUBLIC, and it has to be. A signed-in member cancels from their
          dashboard; a guest has no account, so the uuid in this URL is the
          only credential that exists for their booking. It was returned
          exactly once, on the confirmation screen.

          Sits above the catch-all deliberately: a mistyped token must reach
          this page and be told "that link doesn't match a booking", not be
          bounced to the landing page, which reads as the club having lost
          the booking. */}
      <Route path="/booking/:token" element={<ManageBooking />} />
      {/* ── Class booking · Steps 2, 3, 4, 4b: the shareable class link ──
          /c/:slug is what a coach pastes into the WhatsApp group. Short on
          purpose — it gets pasted into chat, where a long URL line-wraps.

          Section 3 replaced the interim redirect that used to live here. The
          links coaches have already copied keep working and now open the real
          class page, which is why the redirect was a redirect and never a 404.

          The slug identifies the CLASS, not the session — one link per class
          (decision 11), so it keeps working every week. The club is resolved
          from the deployment's tenant key, not from the URL. */}
      <Route
        path="/c/:slug"
        element={
          <Suspense fallback={<PublicBoot />}>
            <ClassPage />
          </Suspense>
        }
      />
      {/* ── Section 3b: the dedicated coaches page ──────────────────────
          Public, because the class page links to it and that page's audience
          arrived from a WhatsApp link without signing in. Deep-linked as
          /coaches#<coach-slug> from a class's coach panel — see the scroll
          effect in Coaches.jsx for why the browser cannot do that itself. */}
      <Route
        path="/coaches"
        element={
          <Suspense fallback={<PublicBoot />}>
            <Coaches />
          </Suspense>
        }
      />
      {/* Public on purpose. The recovery link carries its session in the URL
          fragment; putting this behind RequireAuth would redirect to /login
          before supabase-js has parsed it, burning a single-use link. */}
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* App (auth-gated, inside the shell) */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        {/* The index is the RUNNER's own profile — where a member checks in
            to this week's runs. Those check-ins are the source every other
            number in the app is derived from. */}
        <Route index element={<Profile />} />
        {/* A member's own distance, times and progress. With the club-wide
            Attendance report gone, this is the only place the check-in log is
            summarised — and it summarises it for the person it belongs to. */}
        <Route path="my-runs" element={<MyRuns />} />

        {/* ── Member-visible ──────────────────────────────────────────
            A runner's own screens, plus the shared social surfaces. */}
        {/* The Gym — the weekly class + event timetable. Was "The Hub";
            /app/hub is kept as a redirect rather than deleted because
            SessionDetail links back to it and members will have bookmarked
            it. A rename that 404s the old URL is not a rename, it's a
            deletion plus a new page. */}
        <Route path="gym" element={<Gym />} />
        <Route path="hub" element={<Navigate to="/app/gym" replace />} />
        {/* Dual-mode: a runner applies for a role here, a coach approves
            those applications. See the role split inside Volunteers.jsx —
            it is not a staff screen with a member's view bolted on. */}
        <Route path="volunteers" element={<Volunteers />} />
        <Route path="events" element={<Events />} />
        <Route path="community" element={<Community />} />
        <Route path="add-friend" element={<AddFriend />} />
        {/* Club kit. Member-visible on purpose: buying the shirt is part of
            being in the club, not an admin function. Its counterpart
            /app/sales — what the club SOLD — is staff-gated below. */}
        <Route path="shop" element={<Shop />} />
        <Route path="academy" element={<Academy />} />
        <Route path="academy/:id" element={<Course />} />
        <Route path="settings" element={<Settings />} />
        {/* Deliberately NOT staff-gated, and it is the one awkward case:
            SessionDetail shows a session's attendee register, but The Gym
            (member-visible) navigates members straight into it to view a
            workshop they've booked. Gating it would break that path. The
            LIST at /app/sessions is gated below; only the detail is open. */}
        <Route path="sessions/:id" element={<SessionDetail />} />

        {/* ── Class booking · Step 1a ─────────────────────────────────
            Guarded by RequireClassManager, NOT RequireStaff. Coaches must
            reach this; members must not. That is a different question from
            "may you see the club", which is why it is a different guard —
            see RequireClassManager.jsx. */}
        <Route
          path="classes"
          element={
            <RequireClassManager>
              <Classes />
            </RequireClassManager>
          }
        />

        {/* ── Staff only ──────────────────────────────────────────────
            What's left of the coach's side. Removing these from the sidebar
            was never enough: /app/records is the club's entire people list,
            and before this guard it was one typed URL away from any member.
            See RequireStaff.jsx on why this is the middle layer of three and
            not the real boundary. */}
        <Route path="sessions" element={<RequireStaff><Sessions /></RequireStaff>} />
        {/* The old "Runners" tab. The tab is gone; the club's full people
            list must not be reachable by URL either. Kept when the rest of
            the admin surface went, because Records/:id is where a coach
            reads one runner — attendance history, waiver, emergency
            contact — and that is a community question, not a business one. */}
        <Route path="records" element={<RequireStaff><Records /></RequireStaff>} />
        <Route path="records/:id" element={<RequireStaff><RecordDetail /></RequireStaff>} />

        {/* Catch-all for every URL that used to be a screen: /app/dashboard,
            /app/attendance, /app/business, /app/accounts, /app/pipeline,
            /app/chapters, /app/outreach, /app/sales, /app/assistant,
            /app/style and their detail routes.

            One line instead of eleven redirects, and it does the job the
            root-level catch-all below CANNOT. Without a `*` inside /app, an
            unmatched sub-path fails to complete this branch, falls through to
            the root catch-all, and sends a SIGNED-IN user to the public
            marketing page — which reads as "I've been logged out" rather
            than "that page is gone". This keeps them inside the app. */}
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
