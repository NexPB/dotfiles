/** The status check rollup of a PR's head commit, as GitHub's GraphQL API names it. */
export type RollupState = 'SUCCESS' | 'FAILURE' | 'ERROR' | 'PENDING' | 'EXPECTED'

export type StackBranch = {
  name: string
  pr?: number
  /** GitHub's own PR state: `.git/gh-stack` reports a closed PR as open. */
  prState?: 'OPEN' | 'CLOSED' | 'MERGED'
  ci?: RollupState
  isCurrent: boolean
  isMerged: boolean
  isQueued: boolean
  needsRebase: boolean
}

export type StackView = {
  status: 'loading' | 'none' | 'ok'
  /** Why there is no stack to show, while `status` is `none`. */
  reason?: string
  number?: number
  trunk?: string
  /** Bottom to top. */
  branches: StackBranch[]
}

declare module 'claude-code' {
  interface PluginState {
    'gh-stack': { view: StackView }
  }
}
