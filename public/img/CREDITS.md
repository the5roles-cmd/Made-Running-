# Landing-page photography — provenance

All images are **Made Running's own photography**, pulled from their
public Instagram (`@made.running`) at the client's request. They are not stock.
That is the whole point: the $10K bar (`ten-k-checklist` #05) rejects generic
stock filler, and a pitch page for Made Running should be built out of Made
Running.

| File | Source post | What it is |
|---|---|---|
| `hero-crew-*.jpg` | [Dav7lkQjfIs](https://www.instagram.com/p/Dav7lkQjfIs/?img_index=1) | **Current hero.** Three members arm-in-arm on Deansgate, two in MADE tees. Carousel slide 1 of "hundreds running, one goal", 13 July 2026. |
| `creed-vest-*.jpg` | [DZ5w1eHtc5r](https://www.instagram.com/p/DZ5w1eHtc5r/) (carousel) | "NO ONE GETS LEFT BEHIND / MADE" on the back of a race vest. |
| `support-*.jpg` | [DZ2vxYljfpU](https://www.instagram.com/p/DZ2vxYljfpU/) | One runner holding another up after a session. The creed as a photograph. |
| `hero-pack-*.jpg` | [DZ5w1eHtc5r](https://www.instagram.com/p/DZ5w1eHtc5r/) | **Retired, kept as a spare.** The pack running down Deansgate. Was the hero until the client asked for a different frame. Only 720px wide — a reel cover, which is Instagram's ceiling for that post — so it was soft on Retina at hero size. |

`hero-crew` is a straight photograph rather than a reel frame, so the source is
3995×4096. That is why it is sharp where `hero-pack` was not.

## Two things worth knowing

**1. Reel covers, not composites.** Instagram's `og:image` for a video post
bakes a white play-button triangle into the middle of the frame — platform UI,
and uncroppable because it sits dead centre. These were taken from the
`video_default_cover_frame` variant instead, which is the clean underlying
frame. If any image is ever re-pulled, check for the play button before using
it.

**2. Rights.** These belong to Made Running (or their photographer), not to us.
Fine for the pitch. **Before this domain is handed to anyone outside the
conversation, get the client's explicit sign-off on using their photography** —
and ideally a photographer credit. Two of the three include recognisable faces,
so that sign-off covers likeness as well as copyright.

## Sizes

Two widths per image; the `-900`/`-800` twin is the phone version. Everything is
JPEG at quality 68–78, 120–330 KB. No WebP — neither `cwebp` nor ImageMagick is
installed on this machine, and a second format was not worth a toolchain
dependency for three images.
