# Class card artwork

Drop the Canva exports in this folder. **The filename is the setting** — there is
no code to change and no list to update.

## Filenames

Name each file after the discipline, lowercase:

| File                | Used by                                                      |
| ------------------- | ------------------------------------------------------------ |
| `kettlebells.webp`  | Hot Kettlebells (all 6 sessions — Mon, Tue, Wed, Thu, Sat)    |
| `hiit.webp`         | Dog Business HIIT, The Propain HIIT Class (4 sessions)        |
| `yoga.webp`         | Yoga (1 session)                                              |
| `circuit.webp`      | Circuits (1 session)                                          |

`.webp`, `.avif`, `.jpg` and `.png` all work. WebP is the best trade-off —
roughly a third the size of a JPG at the same quality.

**Four images covers the entire timetable.** A new kettlebells class added next
month picks up the artwork automatically.

## Where the photo appears

Two places, cropped differently, from the same file:

1. **The whole face of the timetable card** on `/book`. The photo fills the
   card and the text sits on top of it.
2. **The banner across the top of the class page** (`/c/<slug>`), which is a
   wide, short strip — 11:3.

## Canva export size

Export at **1200 × 800** (3:2). Anything from 3:2 to 16:9 lands without
distortion; the cards run about **1.5:1 to 1.8:1** depending on how much text
the class carries, so 3:2 is the safe middle.

1200 wide is deliberate overkill: the card is ~350 CSS px on a phone, which is
700 real pixels on a retina screen, and the photo is upscaled to *cover* the
card rather than fitted inside it.

### What to keep in frame

The same file is cropped two different ways, so:

- Put the subject in the **middle third**, horizontally *and* vertically. The
  card crops the sides; the class-page banner crops the top and bottom.
- **No text in the image.** The class name, time and coach are already rendered
  as real text on top of it — text in the photo duplicates it, becomes
  unreadable, and cannot be read by a screen reader or updated when the club
  renames a class.
- **A busy photo is fine; a busy CENTRE is not.** The class name and time sit
  over the upper-left of the card. A face or a piece of kit directly there
  fights the type even through the scrim.

You do not need to darken the photo yourself — see below.

## The scrim

The card lays a **fixed dark gradient** between the photo and the text, from
62% at the top to 90% at the bottom. It is sized for the worst case: even a
pure-white photo composites to about **5:1** against the white type, clear of
the WCAG AA floor of 4.5:1.

Two things follow from that:

- **Do not pre-darken your export.** The scrim is already doing it, and a
  photo darkened twice is a black card.
- **Slightly soft photos are forgiven.** The club's current `yoga.webp` is only
  390 px wide, which would be visibly soft as a crisp image; under the scrim it
  reads as atmosphere. A bigger export is still better, but a small one is not
  a disaster.

The preview in the Classes editor shows the scrim, so what you see there is
what the member sees.

## Per-class crop

If a particular photo needs a different crop, set the focus per class in the
Classes editor (`Image focus`: `top`, `center`, `50% 30%`, …). That overrides
the default for that class **on both surfaces**.

Left unset, each surface uses its own default: `center` on the card (which only
crops sideways) and `center 38%` on the class-page banner (biased upward,
because a centred 11:3 cut takes the top off a room full of raised arms).

## Per-class artwork

To give one class its own photo rather than its discipline's, paste an
`https://` image URL into **Image URL** in the Classes editor. That always wins
over the file in this folder.

## What is in here now

`yoga.webp` — 390 × 220, the club's `Yoga.png` from the Festival folder,
**uncropped**.

It is 390 px wide, not 1200. That is the whole resolution the original had. On
a card, under the scrim, it is fine. A re-export of the same photo at
**1200 × 800** would sharpen both surfaces — drop it in over this file.

(An earlier version of this file was cropped to an 11:3 strip, from when the
photo was a band across the top of the card rather than the whole of it. The
full frame is the right source now: the card crops it horizontally and the
banner crops it vertically, and a pre-cropped strip has nothing left to give
either.)

## Films, not photos

A short clip of the session goes in **`../class-films/`**, which has its own
README and its own rules. It is keyed by discipline exactly like this folder.

## Keep the credits straight

If an image is licensed (Unsplash, a stock library, a photographer), add a line
to `public/img/CREDITS.md` — same as the existing site photography.
