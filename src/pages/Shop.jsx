// ── MADE RUNNING SHOP ────────────────────────────────────────────────────────
// Demo storefront showing the Made Running product range. Products can be
// added to a basket and a checkout handoff is presented to the real Shopify
// storefront. No card-payment form is built here — see the SWAP POINT below.
//
// CSS-only product imagery: each product "shot" is a layered gradient + bold
// typography composition. No photographs are sourced or hotlinked — house rule
// consistent with the landing page.

import { useState, useCallback } from 'react'
import { ShoppingCart, ShoppingBag, Plus, Minus, X, Shirt } from 'lucide-react'
import { PageHead } from '../components/ui'
import {
  PRODUCTS,
  CATEGORIES,
  getCart,
  addToCart,
  setCartQty,
  removeFromCart,
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

function BasketDrawer({ items, onClose, onQty, onRemove, onCheckout }) {
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

            {/* >>> SWAP POINT: replace window.open with Shopify Storefront API
                cart creation. POST the line items to /api/shopify/checkout (your
                server-side proxy), receive a checkoutUrl, and open it. The Admin
                token must NEVER reach the browser — keep it server-side only.
                See also src/lib/shopify.js for the established swap-point style. */}
            <button
              className="btn btn--primary"
              onClick={onCheckout}
              style={{ width: '100%', justifyContent: 'center', minHeight: 52, fontSize: 'var(--fs-md)', fontWeight: 700 }}
            >
              <ShoppingBag size={18} />
              Continue to Made Running Store
            </button>

            {/* Honest demo disclosure — tasteful, small, not a giant banner */}
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
              Demo storefront{' \u2014 '}payment handled on{' '}
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>maderunning.com</span>
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ── Checkout handoff helper ───────────────────────────────────────────────────
// >>> SWAP POINT: see BasketDrawer above.
function doCheckoutHandoff() {
  window.open('https://maderunning.com', '_blank', 'noopener,noreferrer')
}

// ── Main Shop page ────────────────────────────────────────────────────────────

export default function Shop() {
  const [cart, setCart] = useState(() => getCart())
  const [basketOpen, setBasketOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')

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

  const handleCheckout = useCallback(() => {
    doCheckoutHandoff()
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
        />
      )}
    </div>
  )
}
