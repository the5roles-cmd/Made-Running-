// ============================================================
// ACADEMY CONTENT — Made Running's community learning courses.
// Written for runners, run leaders, and community members
// building their own paths — on foot and in life.
// Each program has 3 lessons with real, grounded content.
// Every lesson carries a `video` field: null until filmed, at which
// point it becomes the media URL and the player swaps automatically.
// ============================================================

export const PROGRAMS = [
  {
    id: 'diet',
    title: 'Fuelling for Runners',
    summary:
      'Practical nutrition for people running 2–4 evenings a week — covering what to eat before and after sessions, hydration in Manchester weather, and eating well on a real budget.',
    level: 'Beginner',
    duration: '25 min',
    icon: 'Salad',
    lessons: [
      {
        // >>> SWAP POINT: set to a real video URL (mp4/HLS) or a signed
        // storage URL when the lesson is filmed. Course.jsx renders a real
        // <video> when this is a string and a placeholder frame when null.
        video: null,
        title: 'What to eat before and after an evening session',
        body: `Most Made Running sessions are in the evening, which puts food timing in an awkward spot. You've usually had lunch, you might be running at 6 or 7pm, and a full dinner an hour before is going to sit badly. The practical rule: if you're eating within 90 minutes of a session, keep it small and mostly carbs — something like a banana, a slice of toast, a handful of oats. Your body can handle that volume without it slowing you down. If you're eating two or more hours before, you've got room for a proper meal, and that's actually the better setup: eat, let it digest, run.

After a session is when most people undereat, and it matters more than they realise. In the 30–60 minutes after a run your muscles are primed to absorb what you give them. Protein and carbs together is the combination that does the work — not a supplement, just food. Eggs on toast, rice and beans, pasta with something on it, chicken and whatever's in the fridge. You don't need to be precise about macros; you just need to actually eat something, even if it's late. Skipping the post-session meal because it feels too late is a habit that makes the next session harder than it needs to be.

This is general guidance based on how most healthy people respond to exercise nutrition — if you have a medical condition, a history of disordered eating, or specific dietary needs, this isn't the right place to start. A GP or registered dietitian is, and there's no shame in that distinction.`,
      },
      {
        // >>> SWAP POINT: set to a real video URL (mp4/HLS) or a signed
        // storage URL when the lesson is filmed. Course.jsx renders a real
        // <video> when this is a string and a placeholder frame when null.
        video: null,
        title: 'Hydration that actually works — including in Manchester',
        body: `The standard advice is "drink two litres a day" and while that's not wrong, it misses most of what actually matters. Hydration for runners is less about hitting a daily number and more about knowing the signals. Dark urine, headaches that come on after runs, cramp mid-session, feeling flat even on good sleep — these are all dehydration signals that are easy to misread as fitness problems.

Manchester weather complicates this in a specific way: it's cold and damp often enough that you don't feel like you're sweating, but you are — the body still loses fluid through exertion regardless of temperature, and cold air is also dry air. People running in January underhydrate far more often than people running in July, because the cues aren't there. The practical adjustment: drink water with your pre-session food and have something to drink ready for when you're done, even if you don't feel thirsty. On genuinely hot days or long runs, this matters more — but the base habit matters all year round.

Sports drinks are useful for sessions over 60–75 minutes or on very hot days where you're sweating heavily. For a standard evening run they're mostly unnecessary. Electrolyte tablets in water, or just salted food after a long run, cover what you actually lose. Coffee and tea count towards hydration, despite what you may have heard — the diuretic effect is mild and doesn't cancel the fluid intake.`,
      },
      {
        // >>> SWAP POINT: set to a real video URL (mp4/HLS) or a signed
        // storage URL when the lesson is filmed. Course.jsx renders a real
        // <video> when this is a string and a placeholder frame when null.
        video: null,
        title: 'Eating well on an ordinary budget',
        body: `A lot of runner nutrition advice reads like it was written for someone with a meal-prep dedicated Sunday, a fridge with sectioned containers, and no children. Most of that advice is technically sound and practically useless for the majority of people doing this. What actually works on an ordinary budget is simpler than the fitness industry makes it sound.

The foods that do the most work for runners — carbohydrates for energy, protein for recovery, iron to support the extra oxygen demand — are not expensive. Rice, pasta, oats, potatoes, eggs, tinned fish, frozen veg, tinned beans and lentils, and cheap cuts of meat are all genuinely competitive with expensive alternatives. Frozen veg is often more nutritious than fresh because it's frozen at the point of harvest rather than degrading in transit. A tin of mackerel costs less than a protein bar and does more. None of this requires a specific diet or a shopping list you can't afford.

The other side of budget eating is not skipping meals to compensate for running — and it's worth saying plainly because it happens. Running burns calories, and consistently under-eating while training will make you tired, prone to injury, and eventually unable to sustain the habit. That's especially true for anyone who's historically used exercise as a way to offset food rather than support it. If you're running because you enjoy it and it helps your head — which is a completely legitimate reason and the one most people here have — then eating enough to support the running is part of the deal, not a compromise.`,
      },
    ],
  },
  {
    id: 'mental-health',
    title: 'Running and Mental Health',
    summary:
      'What running genuinely does and does not do for mental health, how to notice when a teammate is struggling, how to have a real conversation without overstepping, and where to point people who need more support.',
    level: 'Intermediate',
    duration: '25 min',
    icon: 'HeartPulse',
    lessons: [
      {
        // >>> SWAP POINT: set to a real video URL (mp4/HLS) or a signed
        // storage URL when the lesson is filmed. Course.jsx renders a real
        // <video> when this is a string and a placeholder frame when null.
        video: null,
        title: "What running actually does for your head — and what it doesn't",
        body: `Running genuinely helps mental health for a lot of people, and there's solid research behind why: consistent aerobic exercise reduces symptoms of depression and anxiety, improves sleep, and creates a reliable rhythm in a life that might otherwise feel chaotic. For many people in this club — including Hermen, who built Made Running out of his own rehabilitation — running has been part of something much bigger than fitness. That's real, and it deserves to be said clearly.

But there's an important line between "running helps" and "running fixes." It does not replace therapy. It does not replace medication for people who need it. It does not resolve trauma, treat clinical depression at its most severe, or manage conditions like PTSD or bipolar disorder on its own. For people in genuine crisis, a run is not the answer — and implying otherwise, even with the best intentions, causes harm. The most useful thing this community can say about running and mental health is the honest version: for many of us, it has been a real part of recovery and maintenance, and it works best alongside other support, not instead of it.

What the community specifically does for mental health is often more important than the running itself: consistency, belonging, a reason to be somewhere at a set time, people who notice when you're not there. These are not small things. They are part of why "No One Gets Left Behind" is a philosophy and not a slogan.`,
      },
      {
        // >>> SWAP POINT: set to a real video URL (mp4/HLS) or a signed
        // storage URL when the lesson is filmed. Course.jsx renders a real
        // <video> when this is a string and a placeholder frame when null.
        video: null,
        title: 'Noticing when someone is struggling',
        body: `You are not expected to be a mental health professional. You are expected to be a person who pays attention. Those are very different things, and the difference matters.

The signals that someone might be struggling are usually not dramatic. They are: a person who used to talk a lot going quiet; someone who's been consistent for months suddenly stopping; a change in how someone carries themselves on a run — not their pace, but something in their manner; comments that sound like they're testing to see if anyone notices. None of these prove anything, and you should not treat them as diagnoses. What they are is a reason to check in — personally, specifically, not as part of a group message.

Checking in doesn't require training. It requires saying, in person or by message, something like: "I've noticed you've not been around — I'm not chasing you to come back, I just wanted to see how you're doing." And then actually listening to the answer. Most of the time the answer will be "yeah, it's been a lot, but I'm okay" and the right response is to believe them, not probe further. Sometimes it will be something more. In that case, your job is still not to fix it — it's to not disappear, and to know what exists beyond this conversation that might help.`,
      },
      {
        // >>> SWAP POINT: set to a real video URL (mp4/HLS) or a signed
        // storage URL when the lesson is filmed. Course.jsx renders a real
        // <video> when this is a string and a placeholder frame when null.
        video: null,
        title: 'Having the conversation — and knowing when to pass it on',
        body: `The most important thing to know before having a difficult conversation with someone who's struggling is where your role ends. You are a run leader, a teammate, a friend from the club — you are not a counsellor, and trying to act as one without training is a way of accidentally making things worse, even with good intentions. Knowing that boundary is not a failure of care. It's part of caring correctly.

In practice: if someone opens up about something serious — a mental health crisis, a return to old patterns, feeling like there's no point — the right response is to listen, to not panic visibly, and to gently name that there's support that exists for exactly this. Andy's Man Club runs free, no-signup, drop-in talking groups for men in cities across the UK, and Made Running has a genuine, long-standing relationship with them. If you're talking to a male runner who seems like they're carrying something heavy, saying "there's a group called Andy's Man Club that some of our lads have found really good, if that's ever useful" is a low-pressure, concrete, specific thing you can offer. It doesn't require them to explain themselves or commit to anything. It opens a door.

For women and non-binary members, different resources exist — the Samaritans (116 123) are always available, MIND has local services, and your GP is always a legitimate starting point. The principle is the same: name something specific, don't push, leave the door open. After a conversation like this, if you feel out of your depth — which is the appropriate response — talk to Hermen or another senior person in the club. Not to report someone, but because you're a person too, and you shouldn't carry that alone.`,
      },
    ],
  },
  {
    id: 'entrepreneurship',
    title: 'Building from Community',
    summary:
      'Made Running is itself a business built from a real community. These lessons cover what the club learned from brand deals and apparel, what separates an audience from a business, and how to price your own work.',
    level: 'Intermediate',
    duration: '25 min',
    icon: 'Rocket',
    lessons: [
      {
        // >>> SWAP POINT: set to a real video URL (mp4/HLS) or a signed
        // storage URL when the lesson is filmed. Course.jsx renders a real
        // <video> when this is a string and a placeholder frame when null.
        video: null,
        title: 'Made Running as a case study: what community-first actually means',
        body: `Made Running did not start as a business. It started as a group of people showing up to run in Manchester, building something real between them, and eventually attracting attention from outside — BBC coverage, boohooMAN, Balenciaga, Barry's Bootcamp. The commercial side came after the community side, and it works because the community side is genuine. That sequence is not an accident. It is the thing.

The lesson is not that you should start a running club and wait for brand deals. The lesson is that the credibility which makes commercial relationships possible — the kind where brands actually want to be associated with you — is built in the opposite direction from most startup advice. It is not built through pitching. It is built through showing up, consistently, to something that has real value to real people, until the value becomes obvious to people outside the room. Made Running's first brand collabs happened because the brands found them, not the other way around. That happened because the community was visibly genuine, visibly growing, and visibly led by someone with a real story.

If you're building something — a business, a project, a creative practice — the most useful question is not "how do I get noticed?" It is "is what I'm building actually worth being noticed?" The work that answers the first question is usually the work that answers the second one first.`,
      },
      {
        // >>> SWAP POINT: set to a real video URL (mp4/HLS) or a signed
        // storage URL when the lesson is filmed. Course.jsx renders a real
        // <video> when this is a string and a placeholder frame when null.
        video: null,
        title: 'The difference between an audience and a business',
        body: `One of the most common mistakes people make when building something from a community is treating reach as revenue. Having a following — on Instagram, in a club, through an email list — is genuinely valuable, but it is not the same as having a business. Made Running has nearly 80,000 Instagram followers. That number opens conversations, gives context for sponsorship, and provides proof of scale. It does not, on its own, pay anyone.

A business has a mechanism for converting the goodwill of a community into sustainable income. For Made Running, that mechanism is multiple: apparel sales through Shopify, brand partnership fees, event revenue, and the ambassador relationships that create ongoing commercial value. Each of those channels required a decision and an infrastructure — a Shopify store actually set up, a rate card that exists, someone responsible for following up. None of it happened automatically because the community grew.

The practical implication for anyone building from a community they belong to: identify the conversion mechanism early, even if you don't act on it immediately. Who would pay money for what, and why? The answer might be the community itself — your own members buying your product or service. It might be brands who want access to your community. It might be institutions who want to pay for the expertise your community has developed. All three are legitimate. But you need to know which one you're building, because they require completely different approaches, and building one badly while pretending it's another is where most community businesses get stuck.`,
      },
      {
        // >>> SWAP POINT: set to a real video URL (mp4/HLS) or a signed
        // storage URL when the lesson is filmed. Course.jsx renders a real
        // <video> when this is a string and a placeholder frame when null.
        video: null,
        title: 'Pricing your own work without underselling yourself',
        body: `The hardest financial habit to build when you come from a community rather than a corporate background is charging appropriate rates. People who build from passion projects, from communities, from something they did for free first, almost universally undercharge — not because they're bad at maths but because the emotional logic of the situation makes undercharging feel safer than the alternative. This is one of the most practically damaging patterns in small business, and it's worth addressing directly.

When Made Running approaches a brand relationship or prices an event partnership, the relevant number is not "what feels like enough to say yes" — it is the market rate for what's actually being offered. A community with 79,000 engaged followers and a demonstrable cultural story (rehabilitation, social impact, real press coverage) is offering genuine commercial value. Underpricing that because it started as something you loved is giving away the value that the community built together. It also sets a precedent that's hard to walk back: the first number you say shapes every conversation that follows it.

Practically: before you price anything, find comparables. What do similar collaborations in your space cost? What do people with similar follower counts or similar community credibility charge? If you genuinely can't find comparables, the principle is: price at the level where you'd feel respected if they said yes, not at the level where you'd feel relieved. Relief is a signal you've priced too low. If someone says your rate is too high, that is useful information — negotiate from there. If they say yes immediately without pushback, that is also useful information.`,
      },
    ],
  },
]

// ── Lookup helper ───────────────────────────────────────────
export function getProgram(id) {
  return PROGRAMS.find((p) => p.id === id) || null
}
