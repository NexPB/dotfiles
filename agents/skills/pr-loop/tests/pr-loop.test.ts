import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { countSuppressed, excerptLog, isPush, readChecks } from '../hooks/github'
import type { Check } from '../hooks/github'

const SHA = 'abc1234def5678'

const UMBRELLA_LOG = [
  'mix_test\tUNKNOWN STEP\t﻿2026-10-07T06:29:00.0000000Z Current runner version',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:01.0000000Z ##[group]Run mix test --warnings-as-errors',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:01.0000000Z shell: /usr/bin/bash -e {0}',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:01.0000000Z ##[endgroup]',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:02.0000000Z ==> core',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:03.0000000Z ...',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:04.0000000Z   1) test polls (Core.PollerTest)',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:04.0000000Z ##[error]     test/core/poller_test.exs:33',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:04.0000000Z      ** (FunctionClauseError) no function clause',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:04.0000000Z ',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:05.0000000Z .....',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:05.0000000Z Result: 9/10 passed',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:05.0000000Z Failed: 1 test',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:06.0000000Z ==> api',
  ...Array.from({ length: 200 }, (_, i) => `mix_test\tUNKNOWN STEP\t2026-10-07T06:29:07.0000000Z [debug] QUERY ${i}`),
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:08.0000000Z Result: 81 passed',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:09.0000000Z ##[error]Process completed with exit code 2.',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:09.0000000Z Post job cleanup.',
  'mix_test\tUNKNOWN STEP\t2026-10-07T06:29:09.0000000Z Cleaning up orphan processes',
].join('\n')

const COPILOT_BODY = '### 🟡 Changes recommended\n\n<details>\n<summary>Review details</summary>\n\n### Suppressed comments (5)\n\n**a.jsx:1**\n* x'

describe('github', () => {
  test('cuts the failing ExUnit test out of an umbrella log', () => {
    const text = excerptLog(UMBRELLA_LOG)
    expect(text).toContain('$ mix test --warnings-as-errors')
    expect(text).toContain('==> core')
    expect(text).toContain('     test/core/poller_test.exs:33')
    expect(text).toContain('Failed: 1 test')
    expect(text).not.toContain('QUERY')
    expect(text).not.toContain('orphan')
  })

  test('keeps the tail of a step that has no ExUnit failure', () => {
    const raw = ['j\ts\t2026-01-01T00:00:00Z ##[group]Run mix credo', 'j\ts\t2026-01-01T00:00:00Z ##[endgroup]']
      .concat(Array.from({ length: 300 }, (_, i) => `j\ts\t2026-01-01T00:00:00Z line ${i}`))
      .concat(['j\ts\t2026-01-01T00:00:00Z ##[error]Process completed with exit code 1.'])
      .join('\n')
    const lines = excerptLog(raw).split('\n')
    expect(lines[0]).toBe('$ mix credo')
    expect(lines[1]).toBe('… 152 lines cut …')
    expect(lines.at(-1)).toBe('line 299')
    expect(lines.length).toBe(150)
  })

  test('counts the suppressed comments of every Copilot review', () => {
    const copilot = { login: 'copilot-pull-request-reviewer' }
    expect(
      countSuppressed([
        { author: copilot, body: '### Suppressed comments (8)', submittedAt: '2026-09-14T00:00:00Z' },
        { author: copilot, body: COPILOT_BODY, submittedAt: '2026-09-15T00:00:00Z' },
        { author: { login: 'octocat' }, body: 'Suppressed comments (2)', submittedAt: '2026-09-16T00:00:00Z' },
      ]),
    ).toBe(13)
    expect(countSuppressed([{ author: copilot, body: 'Comments suppressed due to low confidence (3)' }])).toBe(3)
    expect(countSuppressed([])).toBe(0)
  })

  test('reports a failure while other checks still run', () => {
    const checks: Check[] = [
      { __typename: 'CheckRun', name: 'credo', status: 'COMPLETED', conclusion: 'FAILURE', detailsUrl: 'https://github.com/o/r/actions/runs/1/job/77' },
      { __typename: 'CheckRun', name: 'test', status: 'IN_PROGRESS', conclusion: '' },
      { __typename: 'StatusContext', context: 'deploy', state: 'SUCCESS' },
    ]
    expect(readChecks(checks)).toEqual({
      ci: 'failure',
      checksDone: 2,
      checksTotal: 3,
      failed: [{ name: 'credo', url: 'https://github.com/o/r/actions/runs/1/job/77', jobId: '77' }],
    })
    expect(readChecks([]).ci).toBe('none')
  })

  test('finds a push in a shell command', () => {
    expect(isPush('git push')).toBe(true)
    expect(isPush('git add a && git commit -m x && git push -u origin HEAD')).toBe(true)
    expect(isPush('git -C ../x push')).toBe(true)
    expect(isPush('gh stack push')).toBe(true)
    expect(isPush('git log --grep push')).toBe(false)
    expect(isPush('echo "git push"')).toBe(false)
  })
})

type Remote = { checks: Check[]; threads: { isResolved: boolean; isOutdated: boolean }[] }

const exited = (exitCode: number, stdout = '') => ({
  value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

function onBranch(on: On, remote: Remote) {
  on('process.run', (_$, e) => {
    const argv = e.argv.join(' ')
    if (argv === 'git rev-parse --abbrev-ref HEAD') return exited(0, 'feature\n')
    if (argv === 'git rev-parse HEAD') return exited(0, `${SHA}\n`)
    if (argv.startsWith('gh pr view')) {
      return exited(
        0,
        JSON.stringify({
          number: 42,
          title: 'feat: add the poller',
          url: 'https://github.com/o/r/pull/42',
          state: 'OPEN',
          isDraft: false,
          reviewDecision: 'CHANGES_REQUESTED',
          headRefOid: SHA,
          statusCheckRollup: remote.checks,
          reviews: [{ author: { login: 'copilot-pull-request-reviewer' }, body: COPILOT_BODY, submittedAt: '2026-10-01T00:00:00Z' }],
        }),
      )
    }
    if (argv.startsWith('gh api graphql')) {
      return exited(0, JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes: remote.threads } } } } }))
    }
    if (argv.startsWith('gh run view --job 77')) return exited(0, UMBRELLA_LOG)
    return exited(1)
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('tool.call', async () => ({ result: 'ran' }) as never)
}

const running = (name: string): Check => ({ __typename: 'CheckRun', name, status: 'IN_PROGRESS', conclusion: '' })
const done = (name: string, conclusion: string, job?: string): Check => ({
  __typename: 'CheckRun',
  name,
  status: 'COMPLETED',
  conclusion,
  detailsUrl: job === undefined ? undefined : `https://github.com/o/r/actions/runs/1/job/${job}`,
})

describe('ci watch', () => {
  test('puts the failing log in the conversation, then reports the end of the run', async ($, on) => {
    const clock = mock.clock(on)
    const session = mock.session(on)
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(e.text)
      return { value: undefined } as never
    })
    const remote: Remote = { checks: [done('credo', 'SUCCESS'), done('test', 'SUCCESS')], threads: [] }
    onBranch(on, remote)
    await $.session.start({ cwd: '/r', surface: 'terminal', isInteractive: true })
    await clock.settle()

    remote.checks = [running('credo'), running('test')]
    await $.tool.call({ tool: 'Bash', command: 'git push' } as never)
    await clock.settle()
    expect(toasts).toEqual([])

    remote.checks = [done('credo', 'FAILURE', '77'), running('test')]
    await clock.advance(15_000)
    expect(toasts).toEqual(['#42 CI failed: credo (1 still running). The log is in the conversation.'])
    const [row, notice] = session.appended()
    expect(row?.message.type).toBe('user')
    expect(JSON.stringify(row?.message.content)).toContain('test/core/poller_test.exs:33')
    expect(notice?.message.type).toBe('system')

    remote.checks = [done('credo', 'FAILURE', '77'), done('test', 'SUCCESS')]
    await clock.advance(15_000)
    expect(toasts.at(-1)).toBe('#42 CI finished: 1 of 2 checks failed')

    await clock.advance(60_000)
    expect(toasts.length).toBe(2)
    expect(session.appended().length).toBe(2)
  })

  test('reports a pass on a run it saw start', async ($, on) => {
    const clock = mock.clock(on)
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(e.text)
      return { value: undefined } as never
    })
    const remote: Remote = { checks: [running('test')], threads: [] }
    onBranch(on, remote)
    await $.session.start({ cwd: '/r', surface: 'terminal', isInteractive: true })
    await clock.settle()

    remote.checks = [done('test', 'SUCCESS')]
    await clock.advance(15_000)
    expect(toasts).toEqual(['#42 CI passed (1 checks)'])
  })
})

describe('band', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`draws the PR's CI, threads, suppressed comments and review on ${surface}`, async ($, on) => {
      const clock = mock.clock(on)
      onBranch(on, {
        checks: [done('credo', 'FAILURE', '77'), done('test', 'FAILURE')],
        threads: [
          { isResolved: false, isOutdated: false },
          { isResolved: false, isOutdated: true },
          { isResolved: true, isOutdated: false },
        ],
      })
      on('ui.toast', () => ({ value: undefined }) as never)
      await $.session.start({ cwd: '/r', surface, isInteractive: true })
      await clock.settle()

      const ui = await $.ui.mount({
        plugin: 'pr-loop',
        surface,
        component: 'AbovePrompt',
        props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120 } as never,
      })
      expect(await ui.find({ type: 'Text', text: /feat: add the poller/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /✗ credo \+1/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /2 threads \(1 outdated\)/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /5 suppressed/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /changes requested/ })).toBeDefined()
      await ui.unmount()
    })
  }
})
