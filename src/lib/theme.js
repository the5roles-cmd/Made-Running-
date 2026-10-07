// ============================================================
// TENANT REGISTRY — brand identity per client.
// The active tenant's `key` is written to <html data-tenant="...">
// which activates the matching [data-tenant] block in theme.css.
// Switch ACTIVE_TENANT (or drive it from env) to re-skin.
// ============================================================

export const TENANTS = {
  default: {
    key: 'default',
    name: 'Merlin CRM',
    mark: 'M', // sidebar glyph
    tagline: 'One platform. Every relationship.',
    industry: 'Generic',
  },
  hospital: {
    key: 'hospital',
    name: 'Meridian Health',
    mark: 'M',
    tagline: 'Coordinated care, end to end.',
    industry: 'Private hospital',
  },
  football: {
    key: 'football',
    name: 'City Athletic',
    mark: 'C',
    tagline: 'The club, connected.',
    industry: 'Football club',
  },
  finance: {
    key: 'finance',
    name: 'Sterling Partners',
    mark: 'S',
    tagline: 'Advice that compounds.',
    industry: 'Finance firm',
  },
  pharma: {
    key: 'pharma',
    name: 'Helix Therapeutics',
    mark: 'H',
    tagline: 'From molecule to market.',
    industry: 'Pharmaceutical',
  },
  construction: {
    key: 'construction',
    name: 'Keystone Build',
    mark: 'K',
    tagline: 'Build. Track. Deliver.',
    industry: 'Construction',
  },
  accountancy: {
    key: 'accountancy',
    name: 'Ashford & Co',
    mark: 'A',
    tagline: 'Every number accounted for.',
    industry: 'Accountancy firm',
  },
  maderunning: {
    key: 'maderunning',
    name: 'Made Running',
    mark: 'M',
    tagline: 'No One Gets Left Behind.',
    industry: 'Running community',
  },
}

// Change this ONE line to re-skin the whole app (or read from
// import.meta.env.VITE_TENANT for per-deploy branding).
export const ACTIVE_TENANT_KEY = import.meta.env?.VITE_TENANT || 'default'

export const tenant = TENANTS[ACTIVE_TENANT_KEY] || TENANTS.default

// Apply the tenant's data attribute so theme.css tokens activate.
export function applyTenant() {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-tenant', tenant.key)
  }
  return tenant
}
