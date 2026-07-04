---
name: git-commit
description: "Inspect git changes, generate a professional commit message with FEAT/FIX/DOCS prefix, and execute git add + commit + push."
disable-model-invocation: true
allowed-tools: Bash
---

Run the following commands to inspect the current Git changes:

1. `git status`
2. `git diff`

Analyze the output of those commands and generate a concise, professional commit message in English.

Format rules:
- Use `FEAT: [description]` if I added new tests, features, or enhancements.
- Use `FIX: [description]` if I fixed a bug or a failing test.
- Use `DOCS: [description]` if I only updated documentation (for example README, comments, or docstrings).

Then execute the necessary Git commands to stage, commit, and push the changes.

Execution rules:
- First, run the exact `git add` command(s) needed to stage only the relevant files.
- Then run: `git commit -m "[message]"`
- Finally, run: `git push`

Output rules:
1. Show the exact `git add` command(s) you will run.
2. Show the exact `git commit -m "[message]"` command before running it.
3. Show the exact `git push` command before running it.
4. Then execute all commands.
5. If there is nothing to commit, clearly say so and do not run commit or push.
6. If `git push` requires a specific remote or branch, detect it and use the correct command.

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de esta skill:

🟢 git-commit OK   (🟡 si el push quedó pendiente o un host requiere sync manual; ⏸️ si Tailscale pide auth (exit 75); ⏭️ si no había cambios)

| Dimensión | Estado | Detalle |
|---|---|---|
| Cambios inspeccionados | ✅ | `git status` + `git diff` revisados |
| Commit creado | ✅ | FEAT/FIX/DOCS según el diff — `git commit -m "..."` |
| Push | ✅ | `git push` al upstream OK |
| Propagación al fleet | ✅ | sólo si el repo es vps-ops-toolkit; ver tabla por host |

En `--all` anteponer una columna `repo` (un bloque de filas por repo). Un repo de
proyecto (no el toolkit) marca "Propagación al fleet" como ⏭️ (no se propaga).

Propagación del toolkit — una fila por host:

| Host | Estado | Detalle |
|---|---|---|
| vps-projectapp-prod | ✅ | `SYNCED <sha>` |
| vps-gym | ✅ | `SYNCED <sha>` |
| dev | ⏭️ | `UNREACHABLE` (apagada) |

## Next steps
- (host con `CONFLICT_NEEDS_MANUAL_SYNC`) correr `/git-sync` en ese host — divergencia real
- (si el push quedó pendiente) resolver upstream/conflicto y `git push`
