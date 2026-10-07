// ── MADE RUNNING PRODUCT CATALOGUE ──────────────────────────────────────────
// Static catalogue for the demo storefront. Real inventory should come from
// Shopify's Storefront API once credentials exist.
//
// >>> SWAP POINT: replace this static array with a call to
// GET /api/2024-01/products.json (via your API proxy, never raw credentials
// in the browser). Keep the same shape: { id, name, category, price, ... }.
// Matches the convention established in src/lib/shopify.js.

export const PRODUCTS = [
  {
    id: 'mr-trainer-01',
    name: 'No One Gets Left Behind Trainer',
    category: 'trainers',
    price: 119.99,
    description: 'Low-profile running trainer built for Manchester cobbles and city tarmac alike. Breathable mesh upper, rubber toe cap for parkour landings.',
    colourways: ['Black / White', 'Off White / Black'],
    sizes: ['6', '7', '8', '9', '10', '11', '12'],
    badge: 'New',
    soldOutVariants: [], // all in stock
  },
  {
    id: 'mr-trainer-02',
    name: 'The Crew Trainer',
    category: 'trainers',
    price: 139.99,
    description: 'Chapter-exclusive colourway honouring the founding Manchester crew. Reinforced heel counter for wall-run impact.',
    colourways: ['Cement / Black'],
    sizes: ['6', '7', '8', '9', '10', '11', '12'],
    badge: null,
    soldOutVariants: ['Cement / Black|6', 'Cement / Black|12'],
  },
  {
    id: 'mr-tee-01',
    name: 'Motto Tee',
    category: 'tshirts',
    price: 34.99,
    description: '"No One Gets Left Behind" printed large across the back. 100% organic cotton, oversized cut, boxy hem.',
    colourways: ['Black', 'White'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    badge: null,
    soldOutVariants: ['White|XS'],
  },
  {
    id: 'mr-tee-02',
    name: 'BBC Chapter Tee',
    category: 'tshirts',
    price: 39.99,
    description: 'Celebrated the BBC Sport feature. Embroidered "MR" mark on chest, minimal Manchester chapter text down the left sleeve.',
    colourways: ['Graphite'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    badge: 'Last few',
    soldOutVariants: [],
  },
  {
    id: 'mr-hoodie-01',
    name: 'Rainy City Hoodie',
    category: 'hoodies',
    price: 79.99,
    description: 'Manchester earns its name. Heavyweight 380gsm fleece, oversized hood with a seam-sealed draw channel, kangaroo pocket for essentials.',
    colourways: ['Black', 'Ash Grey'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    badge: null,
    soldOutVariants: ['Ash Grey|XS', 'Ash Grey|S'],
  },
  {
    id: 'mr-cap-01',
    name: 'Chapter Cap',
    category: 'caps',
    price: 29.99,
    description: 'Six-panel structured cap with the MR metal badge pinlock. Adjustable strap, one size fits most.',
    colourways: ['Black', 'White'],
    sizes: null, // one size
    badge: null,
    soldOutVariants: [],
  },
  {
    id: 'mr-shorts-01',
    name: 'Hermen Shorts',
    category: 'shorts',
    price: 44.99,
    description: 'Named for founder Hermen Dange. 4-way stretch, 5-inch inseam, rear zip pocket. Built for movement — free or otherwise.',
    colourways: ['Black'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    badge: null,
    soldOutVariants: [],
  },
  {
    id: 'mr-beanie-01',
    name: 'Crew Beanie',
    category: 'beanies',
    price: 22.99,
    description: 'Fine-rib knit with a relaxed turn-up. The understated way to rep the crew through a Manchester winter.',
    colourways: ['Black', 'Off White'],
    sizes: null, // one size
    badge: null,
    soldOutVariants: ['Off White'],
  },
  {
    id: 'mr-bottle-01',
    name: 'Made Running Water Bottle',
    category: 'accessories',
    price: 27.99,
    description: 'Double-wall insulated 500ml steel bottle. Keeps water cold for 24h. MR wordmark debossed, not printed — no peeling.',
    colourways: ['Matte Black'],
    sizes: null, // one size
    badge: 'New',
    soldOutVariants: [],
  },
  {
    id: 'mr-socks-01',
    name: 'Pavement Crew Socks',
    category: 'socks',
    price: 12.99,
    description: 'Mid-calf running sock, arch-compression band, anti-blister Y-heel. "MADE" embroidered on the left, "RUNNING" on the right.',
    colourways: ['Black / White', 'White / Black'],
    sizes: null, // one size (UK 6–11)
    badge: null,
    soldOutVariants: [],
  },
]

// ── CATEGORY META ────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { id: 'all',         label: 'All' },
  { id: 'trainers',   label: 'Trainers' },
  { id: 'tshirts',    label: 'T-Shirts' },
  { id: 'hoodies',    label: 'Hoodies' },
  { id: 'caps',       label: 'Caps' },
  { id: 'beanies',    label: 'Beanies' },
  { id: 'shorts',     label: 'Shorts' },
  { id: 'accessories',label: 'Accessories' },
  { id: 'socks',      label: 'Socks' },
]

// ── CART HELPERS ─────────────────────────────────────────────────────────────
//
// CART MERGE DECISION — key on variant, not product:
//
//   A "variant" is the combination (productId + colourway + size).
//   The cart key is `${productId}|${colourway}|${size}`.
//
//   Rule 1 — same product, DIFFERENT size → TWO separate lines.
//     Reason: the runner wants both; collapsing them would silently discard
//     one of the chosen sizes, which is worse than a duplicate.
//
//   Rule 2 — same product, same colourway, SAME size → quantity increments
//     on the existing line, not a new line.
//     Reason: the runner almost certainly wants two pairs of the same thing,
//     and showing "Qty: 2" is far clearer than two identical rows that can't
//     be distinguished at a glance.
//
// This means the cart is a map[variantKey → { product, colourway, size, qty }].
// Serialised as an array in localStorage for JSON compatibility.

const STORAGE_KEY = 'mr_cart_v1'

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeStorage(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // localStorage blocked (private mode / storage full) — fail silently
  }
}

export function cartKey(productId, colourway, size) {
  // size may be null for one-size items
  return `${productId}|${colourway ?? ''}|${size ?? ''}`
}

export function getCart() {
  return readStorage()
}

export function addToCart(product, colourway, size) {
  const items = readStorage()
  const key = cartKey(product.id, colourway, size)
  const idx = items.findIndex((i) => i.key === key)
  if (idx >= 0) {
    // Same variant already in cart — increment quantity
    items[idx] = { ...items[idx], qty: items[idx].qty + 1 }
  } else {
    items.push({ key, productId: product.id, colourway, size, qty: 1 })
  }
  writeStorage(items)
  return items
}

export function setCartQty(key, qty) {
  let items = readStorage()
  if (qty <= 0) {
    items = items.filter((i) => i.key !== key)
  } else {
    const idx = items.findIndex((i) => i.key === key)
    if (idx >= 0) items[idx] = { ...items[idx], qty }
  }
  writeStorage(items)
  return items
}

export function removeFromCart(key) {
  const items = readStorage().filter((i) => i.key !== key)
  writeStorage(items)
  return items
}

export function clearCart() {
  writeStorage([])
  return []
}

export function cartTotal(items) {
  return items.reduce((sum, i) => {
    const product = PRODUCTS.find((p) => p.id === i.productId)
    return sum + (product ? product.price * i.qty : 0)
  }, 0)
}

export function cartCount(items) {
  return items.reduce((sum, i) => sum + i.qty, 0)
}

export function isVariantSoldOut(product, colourway, size) {
  if (!product.soldOutVariants || product.soldOutVariants.length === 0) return false
  // For one-size items, soldOutVariants contains just the colourway string
  // For sized items, soldOutVariants contains "colourway|size" strings
  const key = size ? `${colourway}|${size}` : colourway
  return product.soldOutVariants.includes(key)
}
