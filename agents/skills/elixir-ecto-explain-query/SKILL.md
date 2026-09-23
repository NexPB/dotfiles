---
name: elixir-ecto-explain-query
description: Debug a slow Ecto query by adding inline EXPLAIN ANALYZE instrumentation. Use when the user points to a slow Ecto query and wants to know why it is slow.
user-invocable: true
---

# Ecto query EXPLAIN ANALYZE

Instrument an Ecto query with `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)`, read the plan, fix the bottleneck, and measure again.

## Steps

1. **Find the query** that the user means: a composed pipeline or a single `from`.
2. **Instrument it** with the snippet below, just before the query runs.
3. **Trigger the code path.** Run it yourself when a test, a `mix run` or an `iex -S mix` call reaches it. Otherwise ask the user to trigger it. Then read the output file.
4. **Read the plan** for these bottlenecks:
   - Sequential scans on large tables: add an index or a partial index.
   - A materialized subplan from `NOT IN (subquery)`: rewrite it as a correlated `EXISTS`, which stops at the first match.
   - JIT time above about 500 ms: `SET jit = off` for the session, or reduce the query's complexity.
   - High `shared read` against `shared hit`: a cold cache or table bloat.
   - Nested loops with high row estimates: check the join conditions and the indexes on them.
5. **Fix it and measure again** with the same instrumentation. Report the time before and after.
6. **Remove the instrumentation** when the investigation ends.

## Snippet

```elixir
query = <the ecto query>

# Repo.explain/2 raises CaseClauseError on queries with named bindings (`as:`).
{sql, params} = Repo.to_sql(:all, query)

%{rows: rows} =
  Ecto.Adapters.SQL.query!(
    Repo,
    "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) #{sql}",
    params,
    timeout: 30_000
  )

# Logger truncates long output, so write the plan to a file.
File.write!("/tmp/explain_<context>.txt", Enum.map_join(rows, "\n", &hd/1))

{time_us, result} = :timer.tc(fn -> Repo.all(query) end)
File.write!("/tmp/explain_<context>.txt", "\n\n#{time_us / 1_000} ms, #{length(result)} rows\n", [:append])
```

`EXPLAIN ANALYZE` runs the query, so the 30 s timeout covers a slow plan. `FORMAT TEXT` is the readable format; JSON is not.
