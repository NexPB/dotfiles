#!/usr/bin/env bash
# Fetch unresolved review threads for a given PR number, including IDs for replying.
# Usage: fetch-comments.sh <PR_NUMBER>
set -euo pipefail

PR_NUMBER="${1:?Usage: fetch-comments.sh <PR_NUMBER>}"

gh api graphql -f query='
query($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          diffSide
          comments(first: 50) {
            nodes {
              id
              databaseId
              author { login }
              body
              createdAt
            }
          }
        }
      }
    }
  }
}' -F owner='{owner}' -F repo='{repo}' -F pr="$PR_NUMBER" --paginate \
  | jq '[
    .data.repository.pullRequest.reviewThreads.nodes[]
    | select(.isResolved == false)
    | {
        threadId: .id,
        firstCommentDatabaseId: .comments.nodes[0].databaseId,
        path,
        line,
        startLine,
        outdated: .isOutdated,
        comments: [.comments.nodes[] | {author: .author.login, body, createdAt}]
      }
  ]'
