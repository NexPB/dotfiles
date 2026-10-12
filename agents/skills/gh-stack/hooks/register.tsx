import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { RollupState, StackBranch, StackView } from '../types'
import { findGitOps, parseStackFile, verdict } from './guard'
import type { RepoFacts } from './guard'

const PANE = 'gh-stack'
const CI_EVERY_MS = 60_000
const BYPASS = 'If the user wants the raw command, ask them to run it with the ! prefix.'

const view = atom({ plugin: 'gh-stack', key: 'view' } as const, { status: 'loading', branches: [] } as StackView)

type ViewJson = {
  trunk: string
  currentBranch: string
  branches: {
    name: string
    isCurrent: boolean
    isMerged: boolean
    isQueued: boolean
    needsRebase: boolean
    pr?: { number: number }
  }[]
}

type PrNode = {
  state: StackBranch['prState']
  commits: { nodes: { commit: { statusCheckRollup: { state: RollupState } | null } }[] }
}

async function repoFacts($: EngineInterface, dir?: string): Promise<RepoFacts | undefined> {
  const git = await $.process.run(
    ['git', 'rev-parse', '--path-format=absolute', '--git-common-dir', '--abbrev-ref', 'HEAD'],
    { cwd: dir },
  )
  const [commonDir, currentBranch] = git.stdout.trim().split('\n')
  if (git.exitCode !== 0 || commonDir === undefined || currentBranch === undefined) return undefined
  const text = await $.fs.read(`${commonDir}/gh-stack`).catch(() => undefined)
  if (text === undefined) return undefined
  const isStackRebasePaused = await $.fs.stat(`${commonDir}/gh-stack-rebase-state`).then(
    () => true,
    () => false,
  )

  return { ...parseStackFile(text), currentBranch, isStackRebasePaused }
}

async function readCi($: EngineInterface, repository: string, prs: number[]) {
  const [host, slug] = repository.split(':')
  const [owner, name] = (slug ?? '').split('/')
  if (prs.length === 0 || host === undefined || owner === undefined || name === undefined) return undefined
  const fields = prs
    .map(pr => `p${pr}: pullRequest(number: ${pr}) { state commits(last: 1) { nodes { commit { statusCheckRollup { state } } } } }`)
    .join(' ')
  const query = `query { repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { ${fields} } }`
  const api = await $.process.run(['gh', 'api', 'graphql', '--hostname', host, '-f', `query=${query}`], {
    timeoutMs: 20_000,
  })
  if (api.exitCode !== 0) return undefined

  return (JSON.parse(api.stdout) as { data: { repository: Record<string, PrNode | null> } }).data.repository
}

async function refresh($: EngineInterface, withCi: boolean) {
  const local = await $.process.run(['gh', 'stack', 'view', '--json'], { env: { GH_STACK_HYPERLINKS: '0' } })
  if (local.exitCode !== 0) {
    const reason = local.stderr.trim().split('\n')[0]?.replace(/^\W+/, '') || 'Not on a stack branch.'
    await update($, view, (): StackView => ({ status: 'none', reason, branches: [] }))
    return
  }
  const json = JSON.parse(local.stdout) as ViewJson
  const facts = await repoFacts($)
  const number = facts?.stacks.find(stack => stack.branches.includes(json.currentBranch))?.number
  const prs = json.branches.flatMap(branch => (branch.pr === undefined ? [] : [branch.pr.number]))
  const remote = withCi && facts?.repository !== undefined ? await readCi($, facts.repository, prs) : undefined

  await update($, view, (previous): StackView => ({
    status: 'ok',
    number,
    trunk: json.trunk,
    branches: json.branches.map(branch => {
      const pr = branch.pr?.number
      const before = previous.branches.find(one => one.name === branch.name && one.pr === pr)
      const node = pr === undefined ? undefined : remote?.[`p${pr}`]
      return {
        name: branch.name,
        pr,
        prState: node === undefined ? before?.prState : (node?.state ?? undefined),
        ci: node === undefined ? before?.ci : (node?.commits.nodes[0]?.commit.statusCheckRollup?.state ?? undefined),
        isCurrent: branch.isCurrent,
        isMerged: branch.isMerged,
        isQueued: branch.isQueued,
        needsRebase: branch.needsRebase,
      }
    }),
  }))
}

let running: Promise<void> | undefined
let queued: boolean | undefined

// Runs on a timer so the refresh outlives the hook dispatch that asked for it.
function schedule($: EngineInterface, withCi: boolean) {
  if (running !== undefined) {
    queued = (queued ?? false) || withCi
    return
  }
  running = new Promise<void>(resolve => $.clock.after(0, resolve))
    .then(() => refresh($, withCi))
    .catch(() => undefined)
    .finally(() => {
      running = undefined
      if (queued === undefined) return
      const withCiNext = queued
      queued = undefined
      schedule($, withCiNext)
    })
}

const isPaneOpen = async ($: EngineInterface) => (await $.ui.panes()).some(pane => pane.id === PANE)

const CI_BADGE: Record<RollupState, { glyph: string; color: string }> = {
  SUCCESS: { glyph: '✓ ci', color: 'success' },
  FAILURE: { glyph: '✗ ci', color: 'error' },
  ERROR: { glyph: '✗ ci', color: 'error' },
  PENDING: { glyph: '● ci', color: 'warning' },
  EXPECTED: { glyph: '● ci', color: 'warning' },
}

function badges(branch: StackBranch): { text: string; color?: string; isDim?: boolean }[] {
  const list: { text: string; color?: string; isDim?: boolean }[] = []
  list.push(branch.pr === undefined ? { text: 'no PR', isDim: true } : { text: `#${branch.pr}` })
  if (branch.isMerged || branch.prState === 'MERGED') return [...list, { text: 'merged', color: 'merged' }]
  if (branch.prState === 'CLOSED') list.push({ text: 'closed', color: 'error' })
  if (branch.isQueued) list.push({ text: 'queued', color: 'merged' })
  if (branch.needsRebase) list.push({ text: '⚠ rebase', color: 'warning' })
  if (branch.ci !== undefined) list.push({ text: CI_BADGE[branch.ci].glyph, color: CI_BADGE[branch.ci].color })

  return list
}

const fit = (text: string, width: number) =>
  text.length <= width ? text.padEnd(width) : `${text.slice(0, Math.max(0, width - 1))}…`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.clock.every(CI_EVERY_MS, () => {
      void isPaneOpen($).then(isOpen => isOpen && schedule($, true))
    })
    $.clock.after(0, () => {
      void refresh($, true)
        .then(() => read($, view))
        .then(stack => (stack.status === 'ok' ? $.ui.open({ id: PANE, title: 'Stack' }) : undefined))
        .catch(() => undefined)
    })
    // The engine refuses a name that a user skill or another plugin already holds.
    await $.command
      .register({
        name: 'gh-stack-pane',
        description: 'Show the current gh stack: each branch, its PR, rebase and CI state',
      })
      .catch((error: unknown) => $.ui.toast(`gh-stack: /gh-stack-pane not registered: ${String(error)}`))

    return next(e)
  })

  on('command.run', { command: 'gh-stack-pane' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Stack' })
    schedule($, true)

    return { text: 'Stack pane opened.' }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    for (const op of findGitOps(e.command)) {
      const repo = await repoFacts($, op.dir).catch(() => undefined)
      const why = repo === undefined ? undefined : verdict(op, repo)
      if (why !== undefined) return { deny: `gh-stack: ${why} ${BYPASS}` }
    }

    return next(e)
  }).catch(($, e, next) =>
    next.called || findGitOps(e.command).length === 0
      ? next(e)
      : { deny: `gh-stack: could not check whether this git command touches a stack branch. Use gh stack. ${BYPASS}` },
  )

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (/\b(git|gh)\b/.test(e.command) && (await isPaneOpen($))) {
      schedule($, /\b(push|sync|submit|merge)\b/.test(e.command))
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const stack = await read($, view)
    const refreshButton = <Button key="refresh" label="refresh" hotkey="r" onPress={() => schedule($, true)} />

    if (stack.status !== 'ok') {
      return (
        <Box flexDirection="column">
          <Text dimColor>{stack.status === 'loading' ? 'Reading the stack…' : stack.reason}</Text>
          {refreshButton}
        </Box>
      )
    }

    const columns = e.props.bodyColumns
    const rows = [...stack.branches].reverse().map(branch => {
      const marks = badges(branch)
      const marksWidth = marks.reduce((sum, mark) => sum + mark.text.length + 1, 0)
      return (
        <Box key={branch.name} flexDirection="row">
          <Text bold={branch.isCurrent} dimColor={branch.isMerged}>
            {branch.isCurrent ? '» ' : '  '}
            {fit(branch.name, Math.max(8, columns - 2 - marksWidth))}
          </Text>
          {marks.map(mark => (
            <Text color={mark.color} dimColor={mark.isDim}>
              {' '}
              {mark.text}
            </Text>
          ))}
        </Box>
      )
    })

    return (
      <Box flexDirection="column">
        <Text bold>{stack.number === undefined ? 'Stack' : `Stack #${stack.number}`}</Text>
        {rows}
        <Text dimColor>└ {stack.trunk}</Text>
        {refreshButton}
      </Box>
    )
  })
}
