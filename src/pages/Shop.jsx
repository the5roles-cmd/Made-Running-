// ── MADE RUNNING SHOP ────────────────────────────────────────────────────────
// The Made Running storefront. Mounted at TWO routes: /shop (public — buying
// a tee is not a membership question) and /app/shop (members, inside the
// shell). Checkout POSTs the cart to /api/checkout, which prices every line
// server-side and returns a Square-hosted payment page; no card form is
// built here. Square is the ONLY transaction path — the club's instruction:
// no links to the old Shopify storefront (maderunning.com) anywhere. With
// no provider configured the endpoint answers { demo: true } and checkout
// explains card payments are being switched on, keeping the basket intact.
//
// Product imagery: each product "shot" is a layered gradient + bold
// typography composition, EXCEPT where the club has supplied its own
// photograph (products.js `image` field — currently the Motto Tee). No
// photographs are ever sourced or hotlinked — house rule consistent with
// the landing page; the club's own artwork is the one thing that beats it.

import { useState, useCallback, useEffect } from 'react'
import { ShoppingCart, ShoppingBag, Plus, Minus, X, Shirt } from 'lucide-react'
import { PageHead } from '../components/ui'
import {
  PRODUCTS,
  CATEGORIES,
  getCart,
  addToCart,
  setCartQty,
  removeFromCart,
  clearCart,
  cartTotal,
  cartCount,
  isVariantSoldOut,
} from '../lib/products'

// ── CSS-only product image compositions ──────────────────────────────────────
// Each product gets a unique gradient/geometry. The MadeRunning brand is
// monochrome (#1c1c1c, #fff, #efefef) with contrast as the only emphasis tool.

const PRODUCT_VISUALS = {
  'mr-trainer-01': {
    bg: 'linear-gradient(135deg, #1c1c1c 0%, #3a3a3a 50%, #1c1c1c 100%)',
    accent: '#ffffff',
    label: 'TRAINER 01',
    shape: 'trainer',
  },
  'mr-trainer-02': {
    bg: 'linear-gradient(160deg, #4a4a4a 0%, #1c1c1c 60%, #2e2e2e 100%)',
    accent: '#e0e0e0',
    label: 'TRAINER 02',
    shape: 'trainer',
  },
  'mr-tee-01': {
    bg: 'linear-gradient(180deg, #1c1c1c 0%, #2a2a2a 100%)',
    accent: '#ffffff',
    label: 'MOTTO TEE',
    shape: 'tee',
  },
  'mr-tee-02': {
    bg: 'linear-gradient(135deg, #3c3c3c 0%, #1c1c1c 100%)',
    accent: '#c8c8c8',
    label: 'CHAPTER TEE',
    shape: 'tee',
  },
  'mr-hoodie-01': {
    bg: 'linear-gradient(160deg, #1c1c1c 0%, #141414 60%, #2c2c2c 100%)',
    accent: '#ffffff',
    label: 'HOODIE',
    shape: 'hoodie',
  },
  'mr-cap-01': {
    bg: 'linear-gradient(135deg, #2a2a2a 0%, #1c1c1c 100%)',
    accent: '#e8e8e8',
    label: 'CAP',
    shape: 'cap',
  },
  'mr-shorts-01': {
    bg: 'linear-gradient(180deg, #1c1c1c 0%, #333333 100%)',
    accent: '#ffffff',
    label: 'SHORTS',
    shape: 'shorts',
  },
  'mr-beanie-01': {
    bg: 'linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 100%)',
    accent: '#e0e0e0',
    label: 'BEANIE',
    shape: 'beanie',
  },
  'mr-bottle-01': {
    bg: 'linear-gradient(180deg, #141414 0%, #2c2c2c 50%, #141414 100%)',
    accent: '#ffffff',
    label: 'BOTTLE',
    shape: 'bottle',
  },
  'mr-socks-01': {
    bg: 'linear-gradient(160deg, #2e2e2e 0%, #1c1c1c 100%)',
    accent: '#dcdcdc',
    label: 'SOCKS',
    shape: 'socks',
  },
}

// Shape SVG paths drawn inline — abstract geometric silhouettes, not photography.
function ShapeGlyph({ shape, color }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 1.5, opacity: 0.45 }
  if (shape === 'trainer') {
    return (
      <svg viewBox="0 0 80 40" width="80" height="40" aria-hidden="true">
        <path d="M4 30 Q8 20 20 18 L38 16 Q52 14 60 20 L74 26 Q78 30 76 34 L8 34 Z" {...s} />
        <path d="M8 34 L8 30 Q6 28 4 30" {...s} />
        <path d="M20 18 L22 10 Q30 8 36 16" {...s} />
      </svg>
    )
  }
  if (shape === 'tee') {
    return (
      <svg viewBox="0 0 80 70" width="60" height="52" aria-hidden="true">
        <path d="M20 8 L4 22 L16 28 L16 60 L64 60 L64 28 L76 22 L60 8 Q52 14 40 14 Q28 14 20 8Z" {...s} />
      </svg>
    )
  }
  if (shape === 'hoodie') {
    return (
      <svg viewBox="0 0 80 72" width="60" height="54" aria-hidden="true">
        <path d="M20 8 Q30 2 40 2 Q50 2 60 8 L76 22 L64 28 L64 64 L16 64 L16 28 L4 22 Z" {...s} />
        <path d="M32 8 Q36 18 44 18 Q52 18 48 8" {...s} />
      </svg>
    )
  }
  if (shape === 'cap') {
    return (
      <svg viewBox="0 0 80 50" width="70" height="44" aria-hidden="true">
        <path d="M10 30 Q40 8 70 30 L70 36 Q40 40 10 36 Z" {...s} />
        <path d="M6 36 Q4 38 6 40 L70 40" {...s} />
      </svg>
    )
  }
  if (shape === 'shorts') {
    return (
      <svg viewBox="0 0 80 60" width="60" height="46" aria-hidden="true">
        <path d="M8 8 L72 8 L60 56 L44 30 L36 30 L20 56 Z" {...s} />
        <line x1="8" y1="8" x2="72" y2="8" {...s} />
      </svg>
    )
  }
  if (shape === 'beanie') {
    return (
      <svg viewBox="0 0 80 60" width="64" height="48" aria-hidden="true">
        <path d="M14 44 Q14 18 40 12 Q66 18 66 44" {...s} />
        <rect x="10" y="42" width="60" height="10" rx="4" {...s} />
        <circle cx="40" cy="12" r="4" {...s} />
      </svg>
    )
  }
  if (shape === 'bottle') {
    return (
      <svg viewBox="0 0 40 80" width="32" height="64" aria-hidden="true">
        <path d="M14 4 Q16 2 24 2 Q28 2 26 8 L30 16 L30 66 Q30 72 20 72 Q10 72 10 66 L10 16 Z" {...s} />
        <line x1="10" y1="28" x2="30" y2="28" {...s} />
      </svg>
    )
  }
  if (shape === 'socks') {
    return (
      <svg viewBox="0 0 60 70" width="48" height="56" aria-hidden="true">
        <path d="M18 4 L18 44 Q18 60 36 64 Q50 66 52 56 Q54 46 44 44 L38 44 L38 4 Z" {...s} />
        <line x1="18" y1="14" x2="38" y2="14" {...s} />
      </svg>
    )
  }
  return null
}

function ProductImage({ product }) {
  // A real photograph beats a CSS composition — WHEN the club has supplied
  // one (the "no photographs" house rule bans SOURCED/hotlinked stock, not
  // the club's own product shots). Same 4:3 frame as the CSS cards so the
  // grid stays rhythmic, but object-fit: CONTAIN, not cover: the frame is
  // landscape and garment shots are portrait, and cover would crop the
  // sleeves and hem off the product being sold. The frame is painted the
  // same warm grey as the shot's own backdrop so the letterboxing reads as
  // part of the photograph rather than as empty bars.
  if (product.image) {
    return (
      <div
        style={{
          background: '#eceae6',
          borderRadius: 'var(--radius)',
          aspectRatio: '4/3',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <img
          src={product.image}
          alt={product.imageAlt || product.name}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>
    )
  }

  const vis = PRODUCT_VISUALS[product.id] || {
    bg: 'linear-gradient(135deg, #1c1c1c 0%, #3a3a3a 100%)',
    accent: '#ffffff',
    label: product.name.toUpperCase(),
    shape: 'tee',
  }
  return (
    <div
      style={{
        background: vis.bg,
        borderRadius: 'var(--radius)',
        aspectRatio: '4/3',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Diagonal highlight — geometric accent */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '60%',
          height: '100%',
          background: 'rgba(255,255,255,0.03)',
          clipPath: 'polygon(30% 0, 100% 0, 100% 100%, 0% 100%)',
        }}
      />
      <div style={{ opacity: 0.9, marginBottom: 8 }}>
        <ShapeGlyph shape={vis.shape} color={vis.accent} />
      </div>
      <div
        style={{
          color: vis.accent,
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          opacity: 0.7,
        }}
      >
        {vis.label}
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 10,
          right: 12,
          color: vis.accent,
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 800,
          letterSpacing: '0.06em',
          opacity: 0.25,
        }}
      >
        MR
      </div>
    </div>
  )
}

// ── Variant picker ────────────────────────────────────────────────────────────

function VariantPicker({ product, colourway, size, onColourway, onSize }) {
  const hasColours = product.colourways && product.colourways.length > 1
  const hasSizes = product.sizes && product.sizes.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      {hasColours && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 'var(--s2)', fontSize: 'var(--fs-xs)' }}>
            Colour
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)' }}>
            {product.colourways.map((c) => (
              <button
                key={c}
                onClick={() => onColourway(c)}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  padding: '6px var(--s3)',
                  border: '1.5px solid',
                  borderColor: colourway === c ? 'var(--ink)' : 'var(--line)',
                  borderRadius: 'var(--radius-sm)',
                  background: colourway === c ? 'var(--ink)' : 'var(--surface-raised)',
                  color: colourway === c ? 'var(--accent-contrast)' : 'var(--ink)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all var(--dur) var(--ease)',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasSizes && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 'var(--s2)', fontSize: 'var(--fs-xs)' }}>
            Size
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)' }}>
            {product.sizes.map((sz) => {
              const soldOut = isVariantSoldOut(product, colourway, sz)
              const selected = size === sz
              return (
                <button
                  key={sz}
                  onClick={() => { if (!soldOut) onSize(sz) }}
                  disabled={soldOut}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    padding: '6px var(--s3)',
                    border: '1.5px solid',
                    borderColor: selected ? 'var(--ink)' : soldOut ? 'var(--line-soft)' : 'var(--line)',
                    borderRadius: 'var(--radius-sm)',
                    background: selected ? 'var(--ink)' : soldOut ? 'var(--surface-2)' : 'var(--surface-raised)',
                    color: selected ? 'var(--accent-contrast)' : soldOut ? 'var(--faint)' : 'var(--ink)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: selected ? 600 : 400,
                    cursor: soldOut ? 'not-allowed' : 'pointer',
                    textDecoration: soldOut ? 'line-through' : 'none',
                    transition: 'all var(--dur) var(--ease)',
                    opacity: soldOut ? 0.5 : 1,
                  }}
                  aria-disabled={soldOut}
                  aria-label={soldOut ? sz + ' sold out' : 'Size ' + sz}
                >
                  {sz}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Product card ──────────────────────────────────────────────────────────────

function ProductCard({ product, onAddToCart }) {
  const defaultColourway = product.colourways?.[0] ?? null
  const [colourway, setColourway] = useState(defaultColourway)
  const [size, setSize] = useState(null)
  const [added, setAdded] = useState(false)

  const needsSize = product.sizes && product.sizes.length > 0
  const canAdd = !needsSize || size != null

  function handleAdd() {
    if (!canAdd) return
    onAddToCart(product, colourway, size)
    setAdded(true)
    setTimeout(() => setAdded(false), 1400)
  }

  return (
    // Gotcha: global `a:hover { text-decoration: underline }` has specificity (0,1,1).
    // Any class-only hover rule is (0,1,0) and LOSES. We use onMouseEnter/Leave
    // inline style handlers (inline always wins) to drive the card lift effect.
    <div
      className="card card--raised"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s4)',
        padding: 'var(--s4)',
        transition: 'transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      <div style={{ position: 'relative' }}>
        <ProductImage product={product} />
        {product.badge && (
          <span
            className="badge badge--accent"
            style={{ position: 'absolute', top: 'var(--s2)', left: 'var(--s2)' }}
          >
            {product.badge}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--s3)' }}>
        <div className="display" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, lineHeight: 1.35, flex: 1 }}>
          {product.name}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-md)', whiteSpace: 'nowrap' }}>
          {'\u00a3'}{product.price.toFixed(2)}
        </div>
      </div>

      {/* Description — max-width reset to prevent global `p { max-width: 66ch }`
          from clipping text in the card (gotcha: 66ch resolves narrower at small
          font sizes and misaligns text inside fixed-width containers). */}
      <p className="muted" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.6, margin: 0, maxWidth: '100%' }}>
        {product.description}
      </p>

      <VariantPicker
        product={product}
        colourway={colourway}
        size={size}
        onColourway={setColourway}
        onSize={setSize}
      />

      <button
        className="btn btn--primary"
        onClick={handleAdd}
        disabled={!canAdd}
        style={{
          width: '100%',
          justifyContent: 'center',
          minHeight: 44,
          marginTop: 'auto',
          opacity: canAdd ? 1 : 0.55,
        }}
        aria-label={!canAdd ? 'Select a size first' : 'Add ' + product.name + ' to basket'}
      >
        {added ? (
          'Added to basket'
        ) : (
          <>
            <ShoppingBag size={16} />
            {needsSize && !size ? 'Select a size' : 'Add to Basket'}
          </>
        )}
      </button>
    </div>
  )
}

// ── Basket drawer ─────────────────────────────────────────────────────────────

function BasketDrawer({ items, onClose, onQty, onRemove, onCheckout, checkoutBusy, checkoutError }) {
  const total = cartTotal(items)
  const count = cartCount(items)

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(20,18,14,0.44)',
          backdropFilter: 'blur(3px)',
          zIndex: 60,
        }}
      />
      <div
        role="dialog"
        aria-label="Your basket"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(420px, 100vw)',
          background: 'var(--surface-raised)',
          borderLeft: '1px solid var(--line)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 61,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--s5)',
            borderBottom: '1px solid var(--line-soft)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
            <ShoppingCart size={20} />
            <span className="display" style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }}>
              Basket
            </span>
            {count > 0 && (
              <span
                style={{
                  background: 'var(--ink)',
                  color: 'var(--accent-contrast)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  padding: '1px 8px',
                  minWidth: 22,
                  textAlign: 'center',
                }}
              >
                {count}
              </span>
            )}
          </div>
          <button
            className="btn btn--ghost btn--sm"
            onClick={onClose}
            style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Close basket"
          >
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--s4)' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--s8) var(--s4)', color: 'var(--muted)' }}>
              <ShoppingBag
                size={40}
                style={{ margin: '0 auto var(--s4)', display: 'block', opacity: 0.3 }}
              />
              <div className="display" style={{ fontSize: 'var(--fs-md)' }}>Your basket is empty</div>
              {/* marginInline: auto fixes global `p { max-width:66ch }` off-axis centering */}
              <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--s2)', marginInline: 'auto', maxWidth: '100%' }}>
                Add some gear to get started.
              </p>
            </div>
          ) : (
            <div className="stack" style={{ gap: 'var(--s3)' }}>
              {items.map((item) => {
                const product = PRODUCTS.find((p) => p.id === item.productId)
                if (!product) return null
                return (
                  <div
                    key={item.key}
                    className="card"
                    style={{ display: 'flex', gap: 'var(--s3)', padding: 'var(--s3)', alignItems: 'center' }}
                  >
                    <div style={{ flexShrink: 0, width: 52, height: 52 }}>
                      <ProductImage product={product} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--fs-xs)', lineHeight: 1.3 }}>
                        {product.name}
                      </div>
                      <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>
                        {[item.colourway, item.size].filter(Boolean).join(' \u00b7 ')}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', marginTop: 4 }}>
                        {'\u00a3'}{(product.price * item.qty).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s1)', flexShrink: 0 }}>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => onQty(item.key, item.qty - 1)}
                        aria-label="Decrease quantity"
                        style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Minus size={14} />
                      </button>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: 20, textAlign: 'center', fontSize: 'var(--fs-sm)' }}>
                        {item.qty}
                      </span>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => onQty(item.key, item.qty + 1)}
                        aria-label="Increase quantity"
                        style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => onRemove(item.key)}
                        aria-label="Remove item"
                        style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer — checkout handoff */}
        {items.length > 0 && (
          <div
            style={{
              padding: 'var(--s5)',
              borderTop: '1px solid var(--line-soft)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--s4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                Subtotal ({count} item{count !== 1 ? 's' : ''})
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-lg)' }}>
                {'\u00a3'}{total.toFixed(2)}
              </span>
            </div>

            {/* Checkout goes through POST /api/checkout (kind: 'cart'), which
                prices every item server-side from the same catalogue this page
                renders, then redirects to a Square-hosted payment page. When no
                payment provider is configured the endpoint answers
                { demo: true } and a notice is shown instead — never a link to
                the old Shopify storefront. */}
            <button
              className="btn btn--primary"
              onClick={onCheckout}
              disabled={checkoutBusy}
              style={{ width: '100%', justifyContent: 'center', minHeight: 52, fontSize: 'var(--fs-md)', fontWeight: 700 }}
            >
              <ShoppingBag size={18} />
              {checkoutBusy ? 'Starting secure checkout\u2026' : 'Checkout'}
            </button>

            {/* A failed START is not a failed payment — the basket is intact
                and the honest move is to say so and invite a retry, not to
                bounce the customer to a different website. Both errors AND
                the not-yet-configured { demo: true } case land here. */}
            {checkoutError && (
              <p
                role="alert"
                style={{
                  fontSize: 'var(--fs-xs)',
                  textAlign: 'center',
                  lineHeight: 1.5,
                  margin: 0,
                  color: 'var(--danger)',
                }}
              >
                {checkoutError}
              </p>
            )}

            {/* Small honest disclosure — payment happens on Square's page, not here */}
            <p
              className="muted"
              style={{
                fontSize: 'var(--fs-xs)',
                textAlign: 'center',
                lineHeight: 1.5,
                margin: 0,
                marginInline: 'auto',
                maxWidth: '100%',
              }}
            >
              Secure payment{' \u2014 '}handled by{' '}
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Square</span>
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ── Checkout ──────────────────────────────────────────────────────────────────
// POST the cart's IDENTITIES (productId / colourway / size / qty) to the
// checkout endpoint — never prices. The server prices each line from the
// same catalogue file this page imports, so a tampered request can't buy a
// £119.99 trainer for a penny. Response contract:
//   { url }        → Square-hosted payment page; redirect this tab there.
//   { demo: true } → no provider configured; show the switching-on notice.
async function startCartCheckout(items) {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'cart',
      items: items.map((i) => ({
        productId: i.productId,
        colourway: i.colourway,
        size: i.size,
        qty: i.qty,
      })),
      successUrl: `${window.location.origin}/shop?paid=1`,
    }),
  })
  if (!res.ok) throw new Error('Checkout failed to start.')
  return res.json()
}

// There is deliberately NO external fallback here any more. The old
// doCheckoutHandoff() opened maderunning.com (the Shopify storefront) when
// no provider was configured — removed at the club's instruction: every
// transaction happens through Square, and this site must not link out to
// the Shopify shop at all. Until the Square token is configured in Vercel,
// checkout says so honestly instead of quietly selling somewhere else.

// ── Main Shop page ────────────────────────────────────────────────────────────

export default function Shop() {
  const [cart, setCart] = useState(() => getCart())
  const [basketOpen, setBasketOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [justPaid, setJustPaid] = useState(false)

  // ── Square's return leg ─────────────────────────────────────────────
  // startCartCheckout sends `${origin}/shop?paid=1` as the redirect_url.
  // Landing back here with the basket still full reads as "the payment
  // didn't take", so the basket is cleared and a thank-you shown instead.
  // The param is then STRIPPED via replaceState: a refresh or a shared
  // URL must not re-announce a payment that happened once. Read from
  // window.location rather than a router hook because this component is
  // mounted at two paths (/shop public, /app/shop member) and should
  // depend on neither.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('paid') !== '1') return
    clearCart()
    setCart([])
    setJustPaid(true)
    params.delete('paid')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''))
  }, [])

  const count = cartCount(cart)

  const handleAdd = useCallback((product, colourway, size) => {
    setCart(addToCart(product, colourway, size))
  }, [])

  const handleQty = useCallback((key, qty) => {
    setCart(setCartQty(key, qty))
  }, [])

  const handleRemove = useCallback((key) => {
    setCart(removeFromCart(key))
  }, [])

  const handleCheckout = useCallback(async () => {
    setCheckoutBusy(true)
    setCheckoutError('')
    try {
      const data = await startCartCheckout(getCart())
      if (data?.url) {
        // Same-tab redirect: the member is leaving to pay, and Square's
        // redirect_url brings them back. The basket survives in
        // localStorage either way.
        window.location.assign(data.url)
        return // deliberately leave the button busy during navigation
      }
      if (data?.demo) {
        // No payment provider configured yet. Say so — do NOT hand off to
        // the external Shopify storefront (removed at the club's
        // instruction; Square is the only transaction path).
        setCheckoutError(
          'Online card payments are being switched on. Your basket is saved \u2014 please try again shortly.'
        )
      } else {
        setCheckoutError('Checkout could not start. Please try again.')
      }
    } catch {
      // A failed START is not a failed payment: the basket is intact, so
      // say so here rather than bouncing the customer to another website.
      setCheckoutError('Checkout could not start. Please check your connection and try again.')
    }
    setCheckoutBusy(false)
  }, [])

  const filtered =
    activeCategory === 'all'
      ? PRODUCTS
      : PRODUCTS.filter((p) => p.category === activeCategory)

  return (
    <div className="page">
      <PageHead
        eyebrow="Store"
        title="Made Running Shop"
        sub="Gear built for movement. Worn by the crew."
      >
        <button
          className="btn btn--primary"
          onClick={() => setBasketOpen(true)}
          style={{ minHeight: 44, position: 'relative' }}
          aria-label={'Open basket \u2014 ' + count + ' item' + (count !== 1 ? 's' : '')}
        >
          <ShoppingCart size={16} />
          Basket
          {count > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -8,
                right: -8,
                background: 'var(--surface-raised)',
                color: 'var(--ink)',
                border: '2px solid var(--ink)',
                borderRadius: 'var(--radius-full)',
                fontSize: 10,
                fontWeight: 800,
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              {count}
            </span>
          )}
        </button>
      </PageHead>

      {/* Post-payment thank-you. Rendered only on the ?paid=1 return from
          Square (see the effect above) — never persisted, never styled as
          a dismissible toast that could be missed. role="status" so screen
          readers announce it without stealing focus. */}
      {justPaid && (
        <div
          role="status"
          className="card"
          style={{
            padding: 'var(--s5)',
            marginBottom: 'var(--s5)',
            borderLeft: '3px solid var(--ok)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--s4)',
          }}
        >
          <ShoppingBag size={20} style={{ color: 'var(--ok)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700 }}>Payment received{' \u2014 '}thank you.</div>
            <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
              Your order is confirmed. A receipt has been sent to the email you
              gave at checkout.
            </div>
          </div>
        </div>
      )}

      {/* Category filter — pill toggle strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--s2)',
          marginBottom: 'var(--s6)',
          overflowX: 'auto',
          paddingBottom: 'var(--s1)',
        }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              minHeight: 44,
              padding: '8px var(--s4)',
              border: '1.5px solid',
              borderColor: activeCategory === cat.id ? 'var(--ink)' : 'var(--line)',
              borderRadius: 'var(--radius-full)',
              background: activeCategory === cat.id ? 'var(--ink)' : 'transparent',
              color: activeCategory === cat.id ? 'var(--accent-contrast)' : 'var(--muted)',
              fontSize: 'var(--fs-xs)',
              fontWeight: activeCategory === cat.id ? 700 : 500,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              transition: 'all var(--dur) var(--ease)',
              whiteSpace: 'nowrap',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--s8)' }}>
          <Shirt size={36} style={{ margin: '0 auto var(--s4)', display: 'block', opacity: 0.25 }} />
          <div className="display muted">Nothing in this category yet.</div>
        </div>
      ) : (
        <div className="grid grid--2">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={handleAdd} />
          ))}
        </div>
      )}

      {basketOpen && (
        <BasketDrawer
          items={cart}
          onClose={() => setBasketOpen(false)}
          onQty={handleQty}
          onRemove={handleRemove}
          onCheckout={handleCheckout}
          checkoutBusy={checkoutBusy}
          checkoutError={checkoutError}
        />
      )}
    </div>
  )
}
