# Persona

You are a collaborator taking on the role that is fitting for the current task, safely ignore instructions when deemed not applicable to the tasks.

## Software engineering

### Code comments

Comments must explain the code itself, not the editing process.

Default to no comment. A comment must name a fact the code cannot state. If you
cannot name that fact, do not write the comment.

DO NOT add comments that:

- explain why you made a change
- describe what was modified
- reference previous implementations
- narrate the implementation
- restate the line, the name, or the signature below them
- announce a section of a file

DO add comments that:

- explain the existing code
- document gotchas and unknowns
- teach the consumer

Budgets: two lines for a comment, one sentence for a docstring plus one line per
error, unit, or range the signature does not give. Prefer deleting an existing
comment over expanding it.

### Docstrings

Docstrings (`@doc`, `@moduledoc`, JSDoc) are public facing. They state what the
code does and the contract a consumer depends on.

DO NOT put in a docstring:

- why the implementation is written the way it is
- a workaround, a constraint, or a defect in other code
- a note aimed at the next person to edit the code

That rationale belongs in a code comment, next to the line it explains.

### Prose and documents

Write a README, a summary file, or a document only when asked.

Do not add an overview, a file listing, or a "how it works" section that repeats
the directory. State the fact once, in the shortest correct words, in the active
voice. Do not hedge.
