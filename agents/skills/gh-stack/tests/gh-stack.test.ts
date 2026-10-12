import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { findGitOps } from '../hooks/guard'

const STACK_FILE = JSON.stringify({
  schemaVersion: 1,
  repository: 'github.com:octo/fx',
  stacks: [{ id: '1', number: 7, trunk: { branch: 'main' }, branches: [{ branch: 'a' }, { branch: 'b' }] }],
})

const VIEW_JSON = JSON.stringify({
  trunk: 'main',
  currentBranch: 'b',
  branches: [
    { name: 'a', isCurrent: false, isMerged: false, isQueued: false, needsRebase: true, pr: { number: 11 } },
    { name: 'b', isCurrent: true, isMerged: false, isQueued: false, needsRebase: false },
  ],
})

const GRAPHQL = JSON.stringify({
  data: {
    repository: {
      p11: { state: 'OPEN', commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] } },
    },
  },
})

const exited = (exitCode: number, stdout = '', stderr = '') => ({
  value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
})

type Repo = { branch: string; isPaused?: boolean; cwds?: (string | undefined)[] }

function inRepo(on: On, repo: Repo) {
  on('process.run', (_$, e) => {
    const argv = e.argv.join(' ')
    if (argv.startsWith('git rev-parse')) {
      repo.cwds?.push(e.init?.cwd)
      return exited(0, `/r/.git\n${repo.branch}\n`)
    }
    if (argv === 'gh stack view --json') return exited(0, VIEW_JSON)
    if (argv.startsWith('gh api graphql')) return exited(0, GRAPHQL)
    return exited(1, '', 'unknown command')
  })
  on('fs.read', (_$, e) => (e.path === '/r/.git/gh-stack' ? { value: STACK_FILE } : { deny: 'ENOENT' }))
  on('fs.stat', (_$, e) =>
    repo.isPaused === true && e.path === '/r/.git/gh-stack-rebase-state' ? ({ value: {} } as never) : { deny: 'ENOENT' },
  )
  on('tool.call', async () => ({ result: 'ran' }) as never)
}

const denial = async ($: Engine, command: string) => {
  const ran = (await $.tool.call({ tool: 'Bash', command } as never)) as { deny?: string; text?: string; isError?: boolean }
  return ran.deny ?? (ran.isError === true ? ran.text : undefined)
}

describe('findGitOps', () => {
  test('finds rebase, pull and force-push, and skips the rest', () => {
    expect(findGitOps('git rebase main').map(op => op.kind)).toEqual(['rebase'])
    expect(findGitOps('git rebase --continue')).toEqual([{ kind: 'rebase-control', dir: undefined, flag: '--continue' }])
    expect(findGitOps('git pull --rebase').map(op => op.kind)).toEqual(['pull'])
    expect(findGitOps('git pull --ff-only')).toEqual([])
    expect(findGitOps('git push origin b')).toEqual([])
    expect(findGitOps('git push -uf origin b')).toEqual([{ kind: 'force-push', dir: undefined, refs: ['b'], isAll: false }])
    expect(findGitOps('git push origin +b:refs/heads/b')[0]).toMatchObject({ refs: ['b', 'b'] })
    expect(findGitOps('git push --force-with-lease')[0]).toMatchObject({ kind: 'force-push', refs: [] })
    expect(findGitOps('cd ../x && git -C sub push -f')[0]).toMatchObject({ dir: 'sub' })
    expect(findGitOps('cd ../x && GIT_TRACE=1 git push -f')[0]).toMatchObject({ dir: '../x' })
    expect(findGitOps('echo "git rebase main"')).toEqual([])
    expect(findGitOps('gh stack rebase && gh stack push')).toEqual([])
  })
})

describe('guard', () => {
  test('denies a force-push to a stack branch', async ($, on) => {
    inRepo(on, { branch: 'b' })
    expect(await denial($, 'git push --force')).toContain('stack #7')
  })

  test('passes a force-push to a branch outside the stack', async ($, on) => {
    inRepo(on, { branch: 'feature' })
    expect(await denial($, 'git push -f origin feature')).toBeUndefined()
  })

  test('denies a raw rebase and a pull on a stack branch', async ($, on) => {
    inRepo(on, { branch: 'a' })
    expect(await denial($, 'git rebase main')).toContain('gh stack rebase')
    expect(await denial($, 'git pull')).toContain('gh stack sync')
  })

  test('passes a rebase of a branch outside the stack onto a stack branch', async ($, on) => {
    inRepo(on, { branch: 'feature' })
    expect(await denial($, 'git rebase a')).toBeUndefined()
  })

  test('sends --continue through gh stack only while a stack rebase is paused', async ($, on) => {
    const repo: Repo = { branch: 'a', isPaused: true }
    inRepo(on, repo)
    expect(await denial($, 'git rebase --continue')).toContain('gh stack rebase --continue')
    repo.isPaused = false
    expect(await denial($, 'git rebase --continue')).toBeUndefined()
  })

  test('reads the repo the command runs in', async ($, on) => {
    const repo: Repo = { branch: 'feature', cwds: [] }
    inRepo(on, repo)
    await denial($, 'git -C ../other push -f')
    expect(repo.cwds).toEqual(['../other'])
  })
})

describe('session start', () => {
  test('opens the pane on a stack branch even when the command name is taken', async ($, on) => {
    const clock = mock.clock(on)
    const opened: string[] = []
    inRepo(on, { branch: 'b' })
    on('command.register', () => ({ deny: 'it is the user\'s /gh-stack-pane' }))
    on('ui.toast', () => ({ value: undefined }) as never)
    on('ui.open', (_$, e) => {
      opened.push(e.id)
      return { value: { isPlaced: true } } as never
    })
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/r', surface: 'terminal', isInteractive: true })
    await clock.settle()
    expect(opened).toEqual(['gh-stack'])
  })
})

describe('pane', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`draws each layer with its PR, rebase and CI state on ${surface}`, async ($, on) => {
      const clock = mock.clock(on)
      inRepo(on, { branch: 'b' })
      on('ui.open', () => ({ value: { isPlaced: true } }) as never)
      on('ui.panes', () => ({ value: [{ id: 'gh-stack' }] }) as never)
      await $.command.run({ command: 'gh-stack-pane', args: '', origin: { kind: 'composer' } } as never)
      await clock.settle()

      const ui = await $.ui.mount({
        plugin: 'gh-stack',
        surface,
        component: 'Pane',
        requestId: 'gh-stack',
        props: { title: 'Stack', isFocused: false, bodyColumns: 40, placement: 'dock' } as never,
      })
      expect(await ui.find({ type: 'Text', text: /Stack #7/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /#11/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /rebase/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /✗ ci/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /no PR/ })).toBeDefined()
      await ui.unmount()
    })
  }
})
