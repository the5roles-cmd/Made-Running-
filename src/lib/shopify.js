// ── SHOPIFY STUB ──────────────────────────────────────────────────────
// Made Running's real storefront lives on Shopify. This file is the ONE
// seam to swap when real Admin API credentials exist. Today it reads the
// seeded `shopify_orders` demo table via Supabase (org + runner scoped).
//
// >>> SWAP POINT: replace the body of fetchShopifyOrders with a real
// Shopify Admin API call (e.g. GET /admin/api/2024-01/customers/{id}/orders.json,
// mapped through your API proxy so the access token never reaches the
// browser) when credentials are available. Keep the same return shape:
// an array of { id, order_number, total, items, ordered_at }.
//
// SECOND READ PATH — store-wide (Sales page):
// src/pages/Sales.jsx reads the same `shopify_orders` table org-wide via
// the shared hook useList('shopify_orders') in src/lib/useData.js. That
// hook owns its own loading/error/missing states so no second fetch helper
// is needed here (adding one would be dead code). When real Shopify Admin
// API credentials land, BOTH this per-runner path (fetchShopifyOrders) and
// the Sales page's useList call must be swapped together to point at the
// live API so the two surfaces stay consistent.
import { supabase } from './supabase'

export async function fetchShopifyOrders(orgId, runnerId) {
  if (!orgId || !runnerId) return []
  const { data, error } = await supabase
    .from('shopify_orders')
    .select('*')
    .eq('org_id', orgId)
    .eq('runner_id', runnerId)
    .order('ordered_at', { ascending: false })
  if (error) return []
  return data || []
}
