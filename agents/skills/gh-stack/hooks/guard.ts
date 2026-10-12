export type GitOp =
  | { kind: 'rebase'; dir?: string; branch?: string }
  | { kind: 'rebase-control'; dir?: string; flag: string }
  | { kind: 'pull'; dir?: string }
  | { kind: 'force-push'; dir?: string; refs: string[]; isAll: boolean }

const GIT_GLOBALS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace'])
const REBASE_FLAGS_WITH_VALUE = new Set(['--onto', '-x', '--exec', '-s', '--strategy', '-X', '--strategy-option'])
const REBASE_CONTROL = new Set(['--continue', '--abort', '--skip', '--quit', '--edit-todo', '--show-current-patch'])
const PUSH_FLAGS_WITH_VALUE = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec'])

const tokenize = (segment: string): string[] =>
  (segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(token => token.replace(/^(["'])(.*)\1$/, '$2'))

const isForceFlag = (arg: string): boolean =>
  arg === '--force' ||
  arg.startsWith('--force-with-lease') ||
  arg === '--force-if-includes' ||
  arg === '--mirror' ||
  /^-[a-zA-Z]*f[a-zA-Z]*$/.test(arg)

const refNames = (refspec: string): string[] =>
  refspec
    .replace(/^\+/, '')
    .split(':')
    .filter(Boolean)
    .map(ref => ref.replace(/^refs\/heads\//, ''))

function split(args: string[], flagsWithValue: Set<string>) {
  const flags: string[] = []
  const positionals: string[] = []
  let isValue = false
  for (const arg of args) {
    if (isValue) isValue = false
    else if (!arg.startsWith('-')) positionals.push(arg)
    else {
      flags.push(arg)
      isValue = flagsWithValue.has(arg)
    }
  }

  return { flags, positionals }
}

function parseRebase(args: string[], dir: string | undefined): GitOp {
  const control = args.find(arg => REBASE_CONTROL.has(arg))
  if (control !== undefined) return { kind: 'rebase-control', dir, flag: control }

  return { kind: 'rebase', dir, branch: split(args, REBASE_FLAGS_WITH_VALUE).positionals[1] }
}

function parsePush(args: string[], dir: string | undefined): GitOp | undefined {
  const { flags, positionals } = split(args, PUSH_FLAGS_WITH_VALUE)
  const refspecs = positionals.slice(1)
  const isAll = flags.includes('--all') || flags.includes('--branches')
  const isForced = flags.some(isForceFlag) || refspecs.some(refspec => refspec.startsWith('+'))
  if (!isForced) return undefined

  return { kind: 'force-push', dir, refs: refspecs.flatMap(refNames), isAll }
}

/** The git rebase, pull and force-push calls a shell command makes, in order. */
export function findGitOps(command: string): GitOp[] {
  const ops: GitOp[] = []
  let dir: string | undefined

  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const tokens = tokenize(segment.trim())
    while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0] ?? '')) tokens.shift()
    if (tokens[0] === 'cd' && tokens[1] !== undefined) {
      dir = tokens[1]
      continue
    }
    if (tokens[0] !== 'git' && !tokens[0]?.endsWith('/git')) continue

    let segmentDir = dir
    let i = 1
    for (let token = tokens[i]; token?.startsWith('-'); token = tokens[++i]) {
      if (token === '-C') segmentDir = tokens[i + 1]
      if (GIT_GLOBALS_WITH_VALUE.has(token)) i++
    }
    const subcommand = tokens[i]
    const args = tokens.slice(i + 1)

    if (subcommand === 'rebase') ops.push(parseRebase(args, segmentDir))
    if (subcommand === 'pull' && !args.includes('--ff-only')) ops.push({ kind: 'pull', dir: segmentDir })
    if (subcommand === 'push') {
      const push = parsePush(args, segmentDir)
      if (push !== undefined) ops.push(push)
    }
  }

  return ops
}

export type Stack = { number: number; trunk: string; branches: string[] }

export type RepoFacts = StackFile & {
  currentBranch: string
  isStackRebasePaused: boolean
}

const stackOf = (stacks: Stack[], branch: string | undefined) =>
  branch === undefined || branch === 'HEAD' ? undefined : stacks.find(stack => stack.branches.includes(branch))

/** Why an op must go through `gh stack`, or undefined when it may run as is. */
export function verdict(op: GitOp, repo: RepoFacts): string | undefined {
  if (op.kind === 'rebase-control') {
    return repo.isStackRebasePaused
      ? `a gh stack rebase is paused here. Run \`GIT_EDITOR=true gh stack rebase ${op.flag === '--abort' ? '--abort' : '--continue'}\` so the layers above get rebased too.`
      : undefined
  }

  if (op.kind === 'force-push') {
    const targets = op.refs.map(ref => (ref === 'HEAD' ? repo.currentBranch : ref))
    if (targets.length === 0 && !op.isAll) targets.push(repo.currentBranch)
    const hit = op.isAll
      ? repo.stacks.find(stack => stack.branches.length > 0)
      : targets.map(branch => stackOf(repo.stacks, branch)).find(Boolean)
    return hit === undefined
      ? undefined
      : `a force-push to a branch of stack #${hit.number} rewrites it behind gh stack's back. Run \`gh stack push\`, or \`gh stack sync\` to rebase and push the whole stack.`
  }

  const branch = op.kind === 'rebase' ? (op.branch ?? repo.currentBranch) : repo.currentBranch
  const hit = stackOf(repo.stacks, branch)
  if (hit === undefined) return undefined

  return op.kind === 'rebase'
    ? `${branch} is in stack #${hit.number}. A raw git rebase leaves the layers above it on the old commits, which duplicates commits in their PRs. Run \`gh stack rebase\` (or \`gh stack sync\`).`
    : `${branch} is in stack #${hit.number}. A git pull merges the old commits back in after gh stack rebased them. Run \`gh stack sync\`.`
}

export type StackFile = {
  /** `<host>:<owner>/<repo>`, as `gh stack` writes it. */
  repository?: string
  stacks: Stack[]
}

/** The stacks in a `.git/gh-stack` file; none for a file it cannot read. */
export function parseStackFile(text: string): StackFile {
  try {
    const file = JSON.parse(text) as {
      repository?: string
      stacks?: { number?: number; trunk?: { branch?: string }; branches?: { branch?: string }[] }[]
    }
    const stacks = (file.stacks ?? []).map(stack => ({
      number: stack.number ?? 0,
      trunk: stack.trunk?.branch ?? '',
      branches: (stack.branches ?? []).flatMap(one => (one.branch === undefined ? [] : [one.branch])),
    }))
    return { repository: file.repository, stacks }
  } catch {
    return { stacks: [] }
  }
}
