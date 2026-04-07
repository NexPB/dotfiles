---
name: elixir-ecto-explain-query
description: Debug slow Ecto queries by adding inline EXPLAIN ANALYZE instrumentation
user-invocable: true
---

# Ecto Query EXPLAIN ANALYZE

Instrument an Ecto query with `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` to diagnose performance bottlenecks.

## When to use

When the user points to a slow Ecto query and wants to understand why it's slow.

## Steps

1. **Identify the query**: Find the Ecto query the user wants to analyze. It could be a composed query pipeline or a single `from` expression.

2. **Add instrumentation**: Wrap the query execution with timing and EXPLAIN ANALYZE. Use this pattern:

3. **Important notes**:
   - Use `Repo.to_sql/2` + `Ecto.Adapters.SQL.query!/4` instead of `Repo.explain/2` because `Repo.explain` fails with `CaseClauseError` on queries that use named bindings (`:as` option).
   - Write EXPLAIN output to a file — Logger truncates long output.
   - Always add `timeout: 30_000` to the EXPLAIN call since complex queries can take a while.
   - Use `FORMAT TEXT` (not JSON) for human-readable output.

4. **Ask the user to trigger the code path**, then read the EXPLAIN output file.

5. **Analyze the EXPLAIN output** for common bottlenecks:
   - **Sequential scans** on large tables: suggest indexes or partial indexes
   - **Materialized subplans** (`NOT IN subquery`): restructure to `EXISTS` correlated subquery which short-circuits early
   - **JIT compilation overhead**: if JIT time is significant (>500ms), consider `SET jit = off` for the session or reducing query complexity
   - **Large buffer reads** (shared read vs shared hit): indicates cold cache or table bloat
   - **Nested loops with high row estimates**: check join conditions and available indexes

6. **Propose fixes** based on findings, then re-run EXPLAIN ANALYZE to confirm improvement.

7. **Clean up**: Remove all instrumentation code (Logger, File.write!, :timer.tc) once the investigation is complete.

## Example

```elixir
# Build the query as normal
query = <...your_ecto_query...>

# Get raw SQL (works even with named bindings, unlike Repo.explain/2)
{sql, params} = Repo.to_sql(:all, query)

# Run EXPLAIN ANALYZE
explain_result =
  Ecto.Adapters.SQL.query!(
    Repo,
    "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) #{sql}",
    params,
    timeout: 30_000
  )

explain_result.rows
|> Enum.map_join("\n", &hd/1)
|> IO.inspect(label: "<context> EXPLAIN ANALYZE", printable_limit: :infinity, limit: :infinity)

# Time the actual query
{time_us, result} = :timer.tc(fn -> Repo.all(query) end)
Logger.warning("<context>: query took #{time_us / 1_000}ms, returned #{length(result)} rows")
```
