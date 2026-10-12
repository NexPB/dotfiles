import type { CiState, FailedCheck, PrView } from '../types'

export const PR_FIELDS = 'number,title,url,state,isDraft,reviewDecision,headRefOid,statusCheckRollup,reviews'

export type Check =
  | { __typename: 'CheckRun'; name: string; status: string; conclusion: string; detailsUrl?: string }
  | { __typename: 'StatusContext'; context: string; state: string; targetUrl?: string }

export type Review = { author?: { login?: string } | null; body?: string; submittedAt?: string }

export type PrJson = {
  number: number
  title: string
  url: string
  state: string
  isDraft: boolean
  reviewDecision: string
  headRefOid: string
  statusCheckRollup: Check[] | null
  reviews: Review[] | null
}

const FAILED_CONCLUSIONS = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE'])

/** `CiState` is `failure` as soon as one check fails, while others may still run. */
export function readChecks(checks: Check[]): {
  ci: CiState
  checksDone: number
  checksTotal: number
  failed: FailedCheck[]
} {
  const failed: FailedCheck[] = []
  let done = 0
  for (const check of checks) {
    if (check.__typename === 'CheckRun') {
      if (check.status !== 'COMPLETED') continue
      done++
      if (FAILED_CONCLUSIONS.has(check.conclusion)) {
        failed.push({ name: check.name, url: check.detailsUrl, jobId: check.detailsUrl?.match(/\/job\/(\d+)/)?.[1] })
      }
    } else {
      if (check.state === 'PENDING' || check.state === 'EXPECTED') continue
      done++
      if (check.state !== 'SUCCESS') failed.push({ name: check.context, url: check.targetUrl })
    }
  }
  const ci: CiState =
    checks.length === 0 ? 'none' : failed.length > 0 ? 'failure' : done < checks.length ? 'pending' : 'success'

  return { ci, checksDone: done, checksTotal: checks.length, failed }
}

const SUPPRESSED = /(?:Suppressed comments|Comments suppressed due to low confidence)\s*\((\d+)\)/i

/** The suppressed comment count summed over every Copilot review, duplicates included. */
export function countSuppressed(reviews: Review[]): number {
  return reviews
    .filter(review => /copilot/i.test(review.author?.login ?? ''))
    .reduce((sum, review) => sum + Number(review.body?.match(SUPPRESSED)?.[1] ?? 0), 0)
}

export function toView(branch: string, pr: PrJson): PrView {
  return {
    status: 'ok',
    branch,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    isDraft: pr.isDraft,
    review: pr.reviewDecision || undefined,
    sha: pr.headRefOid,
    ...readChecks(pr.statusCheckRollup ?? []),
    suppressed: countSuppressed(pr.reviews ?? []),
  }
}

/** `{ host, owner, name }` of a PR URL such as `https://github.com/o/r/pull/1`. */
export function repoOf(url: string): { host: string; owner: string; name: string } | undefined {
  const match = url.match(/^https?:\/\/([^/]+)\/([^/]+)\/([^/]+)\/pull\/\d+/)
  if (match === null) return undefined
  const [, host, owner, name] = match as unknown as [string, string, string, string]

  return { host, owner, name }
}

export const THREADS_QUERY =
  'query($owner: String!, $name: String!, $pr: Int!) { repository(owner: $owner, name: $name) { pullRequest(number: $pr) { reviewThreads(first: 100) { nodes { isResolved isOutdated } } } } }'

export type ThreadsJson = {
  data: { repository: { pullRequest: { reviewThreads: { nodes: { isResolved: boolean; isOutdated: boolean }[] } } } }
}

export function countThreads(json: ThreadsJson): { threads: number; outdatedThreads: number } {
  const open = json.data.repository.pullRequest.reviewThreads.nodes.filter(thread => !thread.isResolved)

  return { threads: open.length, outdatedThreads: open.filter(thread => thread.isOutdated).length }
}

/** True for a shell command that pushes the current branch. */
export function isPush(command: string): boolean {
  return command
    .split(/&&|\|\||[;|\n]/)
    .some(segment => /^\s*(\w+=\S*\s+)*(git(\s+-C\s+\S+)?\s+push|gh\s+stack\s+(push|sync|submit))\b/.test(segment))
}

// --log-failed returns the whole job on some self-hosted runners, so the
// failing step is cut out at the runner's own exit-code line.
const RUNNER_PREFIX = /^[^\t]*\t[^\t]*\t﻿?(\d{4}-\d\d-\d\dT[\d:.]+Z )?/
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g
const EXIT_LINE = /^##\[error\]Process completed with exit code/

/** The tail of the failing step of a `gh run view --log-failed` log, at most `maxLines` lines. */
export function excerptLog(raw: string, maxLines = 150): string {
  const lines = raw.split('\n').map(line => line.replace(RUNNER_PREFIX, '').replace(ANSI, '').trimEnd())
  const exit = lines.findIndex(line => EXIT_LINE.test(line))
  const end = exit === -1 ? lines.length : exit
  let start = 0
  for (let i = end - 1; i >= 0; i--) {
    if (lines[i]?.startsWith('##[group]Run ')) {
      start = i
      break
    }
  }

  const kept: string[] = []
  let isInGroup = false
  for (const line of lines.slice(start, end)) {
    if (line.startsWith('##[group]')) {
      if (line.startsWith('##[group]Run ')) kept.push(`$ ${line.slice('##[group]Run '.length)}`)
      isInGroup = true
    } else if (line.startsWith('##[endgroup]')) {
      isInGroup = false
    } else if (!isInGroup) {
      // The runner puts ##[error] before an indented line inside an ExUnit failure too.
      kept.push(line.replace(/^##\[(error|warning)\](?=\s)/, '').replace(/^##\[(error|warning)\]/, '$1: '))
    }
  }
  while (kept.at(-1) === '') kept.pop()

  const failures = exUnitFailures(kept)
  if (failures.length > 0) {
    const summary = kept.filter(line => /^(Result: \d+\/|Failed: |\d+ (tests|doctests|properties)\b.*\bfailures?\b)/.test(line))
    kept.splice(1, kept.length, ...failures, '', ...summary)
  }
  if (kept.length <= maxLines) return kept.join('\n')

  const tail = kept.slice(-(maxLines - 2))

  return [kept[0], `… ${kept.length - 1 - tail.length} lines cut …`, ...tail].join('\n')
}

const EXUNIT_FAILURE = /^\s+\d+\) (test|doctest|property) /

// An umbrella `mix test` prints a failure in one app and then runs the other
// apps, so the tail of the log can hold no failure at all.
function exUnitFailures(lines: string[]): string[] {
  const out: string[] = []
  let app: string | undefined
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.startsWith('==> ')) app = line
    if (!EXUNIT_FAILURE.test(line)) continue
    if (app !== undefined) out.push(app)
    app = undefined
    let j = i + 1
    while (j < lines.length && (lines[j] === '' || /^\s/.test(lines[j] ?? ''))) j++
    out.push(...lines.slice(i, j))
    i = j - 1
  }

  return out
}
