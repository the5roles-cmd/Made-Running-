// ============================================================
// Shared data hooks. Every read is scoped to the active org
// (belt-and-braces with RLS). Screens use these instead of
// hand-rolling Supabase calls, so loading/empty/error behave
// consistently everywhere.
// ============================================================
import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigured, TABLE_MISSING, isNetworkError } from './supabase'
import { isDemoAuth } from './demoAuth'
import { useAuth } from '../auth/AuthProvider'

// ── What counts as worth telling the user about ─────────────────────────
// A read that fails because the database is unreachable is not news on a
// screen whose whole build is already flagged "no live database" — it is the
// expected condition, repeated once per hook, as a red box on every page.
//
// Narrow on purpose. Only transport failures are swallowed, and only while
// demo mode is on: a real Postgres error still surfaces, because that one
// means a query is wrong and is exactly what a demo build should still be
// able to show you. Supabase reports transport failures through `message`
// with no `code`, so the TypeError test in isNetworkError cannot be reused
// directly here — match the text, but only when there is no code to trust.
const NETWORK_TEXT = /failed to fetch|load failed|networkerror|fetch failed/i
function silenced(err) {
  if (!isDemoAuth || !err) return false
  return isNetworkError(err) || (!err.code && NETWORK_TEXT.test(err.message || ''))
}

// Generic list read: useList('accounts', { order: 'name' })
export function useList(table, { order = 'created_at', ascending = false, select = '*' } = {}) {
  const { orgId } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabaseConfigured || !orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from(table)
      .select(select)
      .eq('org_id', orgId)
      .order(order, { ascending })
    if (err) {
      if (err.code === TABLE_MISSING) setMissing(true)
      else if (!silenced(err)) setError(err.message)
    } else {
      setRows(data || [])
      setError(null)
    }
    setLoading(false)
  }, [table, orgId, order, ascending, select])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { rows, loading, error, missing, refresh, setRows }
}

// Single row by id.
export function useRow(table, id, select = '*') {
  const { orgId } = useAuth()
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!supabaseConfigured || !orgId || !id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase.from(table).select(select).eq('org_id', orgId).eq('id', id).single()
    setRow(data || null)
    setLoading(false)
  }, [table, id, orgId, select])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { row, loading, refresh }
}

// Insert helper that stamps org_id automatically.
export function useInsert(table) {
  const { orgId } = useAuth()
  return useCallback(
    async (values) => {
      const { data, error } = await supabase
        .from(table)
        .insert({ ...values, org_id: orgId })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    [table, orgId],
  )
}

// Update helper (org-scoped).
export function useUpdate(table) {
  const { orgId } = useAuth()
  return useCallback(
    async (id, values) => {
      const { data, error } = await supabase
        .from(table)
        .update(values)
        .eq('id', id)
        .eq('org_id', orgId)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    [table, orgId],
  )
}
