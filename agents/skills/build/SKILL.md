---
name: build
description: "Implement a feature as thin end-to-end slices instead of an up-front spec. Use when asked to build, implement, add, or wire up a feature, or to continue one already in flight. Not for one-line fixes or pure refactors."
argument-hint: "[the feature, or nothing to continue the one in flight]"
---

# Build

One slice at a time. Figure it out by writing code, not by writing a plan.

The failure this exists to prevent is the up-front spec: requirements lists, numbered task breakdowns, acceptance-criteria tables, a document tree that is obsolete the moment the first real file is opened. You do not know enough at the start to write any of that, and neither does the person asking.

So you learn the same way they do — by building the smallest real thing and looking at what it tells you.

## Never

- Write a spec, a requirements list, or a numbered task breakdown.
- Plan more than one slice ahead. Slice 3 does not exist yet and will be wrong.
- Build scaffolding for a slice you haven't cut. No abstraction with one caller, no config flag nothing reads, no interface with one implementation.
- Ask the user something the code can answer. If you don't know what the API returns, call it. If you don't know whether the column is nullable, look.
- Leave a stub, a TODO, or a half-wired path behind a slice you called done.

## Steps

**1. Orient.** Read `notes/<slug>.md` if it exists. Find the two or three files the change actually lands in and read them. Stop there — this is minutes, not a survey. If a slice is already in flight, pick it up instead of re-cutting it.

**2. Cut the slice.** The smallest change that is real end to end: something that runs, that you could show someone. Say it in three lines.

- what works after this that didn't before
- where the code lands
- how you'll know it worked

Can't say it in three lines? The slice is too big. Cut again. A slice that only makes sense as a step toward a later slice is not a slice.

**3. Check for a fork.** Stop and ask only when a decision has two defensible answers **and** picking wrong costs rework you can't cheaply undo — a data shape, a dependency, a public contract. Batch every such question into one round. Everything else: pick, say which in one line, keep moving. Reversible beats correct.

**4. Build it.** The whole slice, nothing extra. Match the surrounding code's idiom, naming, and comment density.

**5. Prove it ran.** Run it — the test, the endpoint, the command, the page. Paste what happened. "Should work" is not done, and a passing type-check is not a run.

**6. Log what you learned.** Append to `notes/<slug>.md`. Create it on the first decision worth keeping, not before — a feature that taught you nothing gets no file.

```
# <slug>

**Goal:** one line

**Decisions**
- 09-15 tokens in redis, 15m TTL — no new table
- 09-15 reuse existing mailer, skip templating

**Next:** rate-limit the send endpoint
```

Only decisions that would cost real rework to rediscover, and only in hindsight — never write the line before doing the thing. Twenty lines is the cap: when it overflows, delete the lines that stopped mattering. It is a log, not a plan.

**7. Name the next slice** in one line, in the same message as the first tool call that builds it. A turn that ends on "next I'll do X" leaves X undone until the user answers. Come back to the user only at a fork from step 3, when a blocker needs them, or when the feature is done.

## What to hand back

- **The slice.** What now works that didn't before.
- **Proof.** What you ran and what it printed.
- **Decided along the way.** One line each, only the ones that constrain what comes next.
- **Next slice.** One line.

No summary of files touched — the diff says that. No report on how it went.
