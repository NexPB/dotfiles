---
name: blast-radius
description: "Find what a change could break somewhere else before it ships, beyond the diff, and prove the one fact it's safe because of by running real code instead of writing it up. Use for 'blast radius of X', 'what could this break', or reviewing a small diff you don't trust."
disable-model-invocation: true
---

# Blast radius

Find what a change breaks somewhere else, before it ships.

Listing the callers is not the job: grep does that in a second. The job is the breakage grep does not show.

## Prove, don't persuade

A writeup that sounds right reads the same whether or not it is true. So the deliverable is not the writeup. It is the one or two facts that the change's safety depends on, proven by running code.

For each such fact, get it as far down this ladder as is cheap, and say where it stopped:

1. You said so. Worth nothing on its own.
2. You pointed at the line: a real `file:line`, or the library's own source.
3. You walked the failure step by step and showed it does not reach.
4. You ran it: a script or test that calls the real code and fails loudly if you are wrong.
5. You reproduced it in the running app.

Mark any safety fact below step 4 as unproven. Step 4 is usually one small script that imports the library version the app ships and calls the exact function in question.

## Steps

1. **Read the change.** The diff, the symbols it adds, changes and deletes, and what now behaves differently, including what the diff does not spell out. Pull the PR description and the commit messages with `gh pr view` and `git log` for the intent.
2. **Find the one fact it is safe because of.** Most scary-looking changes are safe because of one fact, like "this call only drops cache entries that are already dead". If that fact holds, most of the scary cases fall at once. Spend the time here, not on a long list of maybes.
3. **Look where grep stops.** Read the source of the library you call, at its pinned version, with any local patch. Work out when things run: microtasks, unmount and teardown, Solid versus React. Follow what a symbol search misses: the JSON an API returns, a DB column, a wire format, another language that reads the same bytes, a feature flag, code three hops downstream.
4. **Rate each risk.** Give it a real chance and a real cost. Keep the confirmed risks apart from the ones you checked and cleared. Cite a real `file:line` for each; a search that finds nothing is an answer too. Never invent a caller or an API.
5. **Prove the one fact.** Write the script or test, run it, and paste what it printed.
6. **For a wide change,** ask the same question of two or three subagents on different models (the Agent `model` override) and merge what they find. Different models catch different real bugs.

## What to hand back

Lead with the verdict: safe, safe if the one fact holds, or not safe.

- **What it does.** What changed, including the part that is not obvious.
- **The one fact it is safe because of.** The fact, the ladder step it reached, and the proof, or "unproven".
- **Risks.** Each names how it breaks, the `file:line`, how likely and how bad, and how to check. Paste the proof for the ones that matter.
- **Cleared.** What you checked, and why it is fine.
- **Before you merge.** The cheapest test or repro that catches the real bug, including the script you wrote.

Cite real code. Strip anything private before the writeup goes anywhere public.
