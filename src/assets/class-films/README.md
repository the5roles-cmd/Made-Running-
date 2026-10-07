# Class films

A short clip of a session, shown inside the description on the class page
(`/c/<slug>`) — above the date picker, because people watch it to decide
whether to book.

**The filename is the setting.** Same rule as `../classes/` (the card artwork):
name the file after the **discipline**, lowercase, and it appears. No code to
change, no list to keep in sync.

| File              | Appears on                                                 |
| ----------------- | ---------------------------------------------------------- |
| `yoga.mp4`        | Yoga (Thursday 7pm)                                         |
| `kettlebells.mp4` | Hot Kettlebells, Kettlebells, The Valley (6 sessions)       |
| `hiit.mp4`        | Dog Business HIIT, The Propain HIIT Class, Hustle Hard      |
| `circuit.mp4`     | CaTcH a Circuit                                             |

One film covers every class in its discipline, and a new kettlebells class
added next month picks it up on the day it goes on the timetable.

## The poster frame

Put a **still beside the film with the same name** — `yoga.mp4` + `yoga.webp`.
That is what shows before anyone presses play.

It matters more than it sounds. Without one the browser paints a black
rectangle until the first frame decodes, which on this pale page looks like a
broken embed rather than a video.

**Take the still from the film itself, not from the card photo.** The club's
`Yoga.png` and `Yoga.mp4` are two different rooms — using the photo as the
poster would show one studio and then play another the moment you press play.
One command, from the second the film looks best:

```sh
ffmpeg -ss 5 -i yoga.mp4 -frames:v 1 -vf scale=1280:720 yoga.png
# then convert to .webp (about a third the size)
```

## Encoding

The class page column is **600 px** wide, so **1280 × 720** is already twice
what a retina phone can show. Anything larger is bytes nobody sees.

```sh
ffmpeg -i source.mov \
  -vf "scale=1280:720:flags=lanczos" \
  -c:v libx264 -preset slow -crf 23 -profile:v high -pix_fmt yuv420p \
  -an -movflags +faststart \
  yoga.mp4
```

Three of those flags are doing real work:

- **`-movflags +faststart`** — non-negotiable. Without it the file's index
  (`moov`) is written at the *end*, so a browser must download the whole thing
  before it can play a single frame. The club's original Yoga.mp4 was like
  this: 11 MB before anything happened. With the flag, the index is at byte 32
  and playback starts almost immediately.
- **`-an`** — drops the audio. Only do this when the clip is genuinely silent
  (check with `ffmpeg -i in.mp4 -af volumedetect -f null -`; the Yoga source
  measured **-91 dB**, i.e. nothing). A silent *track* is worse than no track:
  the browser draws a volume slider, and a member who hears nothing turns their
  phone up and concludes the site is broken. If a clip has a coach talking,
  keep the audio — use `-c:a aac -b:a 96k` — and **add a caption** via
  `video_caption` in the Classes editor, because a spoken clip with no captions
  excludes anyone who cannot hear it.
- **`-pix_fmt yuv420p`** — some cameras record 4:2:2, which Safari will not
  decode. This makes the file play everywhere.

Result for the Yoga clip: **11.4 MB → 1.06 MB**, same 12 seconds, same picture
at the size it is actually displayed.

### Keep it short

Ten to twenty seconds. Long enough to show the room, the kit and how busy it
is; short enough that nobody is deciding whether to sit through it.

### Music

If a clip has a music bed, that is a licensing question before it is a
technical one — a track that is fine on an Instagram story is not automatically
fine on a website that takes payments. The Yoga clip is silent, so it does not
arise.

## When this does *not* show

A film here is the **discipline default**. It is suppressed entirely for any
class with a **Video URL** set in the Classes editor, because a link the club
pasted is a deliberate per-class choice and beats a default we supplied. That
also stops two different videos appearing under one description with nothing
saying which is the class.

## Keep the credits straight

Licensed or stock footage: add a line to `public/img/CREDITS.md`, same as the
site photography.
