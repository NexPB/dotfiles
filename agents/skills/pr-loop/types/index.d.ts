export type CiState = 'none' | 'pending' | 'success' | 'failure'

export type FailedCheck = {
  name: string
  url?: string
  /** The GitHub Actions job id, when the check is an Actions job. */
  jobId?: string
}

export type PrView = {
  status: 'loading' | 'none' | 'ok'
  branch?: string
  number?: number
  title?: string
  url?: string
  isDraft?: boolean
  /** GitHub's `reviewDecision`: `APPROVED`, `CHANGES_REQUESTED` or `REVIEW_REQUIRED`. */
  review?: string
  /** The PR head commit. */
  sha?: string
  ci?: CiState
  checksDone?: number
  checksTotal?: number
  failed?: FailedCheck[]
  threads?: number
  outdatedThreads?: number
  /** The count in the latest Copilot review's suppressed comments block, which opens no thread. */
  suppressed?: number
}

/** A head commit whose CI run the mod reports when it ends. */
export type CiWatch = {
  pr: number
  sha: string
  /** Epoch milliseconds. */
  since: number
  /** The failed checks whose logs are already in the conversation. */
  reported: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'pr-loop': { view: PrView; watch: CiWatch | null }
  }
}
