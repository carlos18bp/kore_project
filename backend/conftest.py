import os

import coverage as coverage_module
import pytest

# Bar widths: per-file bars use MINI, the TOTAL row uses WIDE
_MINI_W = 13
_WIDE_W = 15


def _color_for(pct):
    """Return a pytest terminal color name based on coverage percentage."""
    if pct > 80:
        return "green"
    if pct >= 50:
        return "yellow"
    return "red"


def _bar(pct, width):
    """Build a Unicode progress bar: █ for covered, · for uncovered."""
    filled = round(pct / 100 * width)
    return "█" * filled + "·" * (width - filled)


def pytest_sessionstart(session) -> None:
    """
    Suppress the default pytest-cov terminal summary.
    This runs at session start and replaces the built-in hook with a no-op
    so it doesn't print its own coverage table.
    """
    cov_plugin = session.config.pluginmanager.get_plugin("_cov")
    if cov_plugin is None:
        return
    hook = session.config.pluginmanager.hook.pytest_terminal_summary
    for impl in hook.get_hookimpls():
        if impl.plugin is cov_plugin:
            impl.function = lambda *args, **kw: None
            break


@pytest.hookimpl(tryfirst=True)
def pytest_configure(config):
    """
    Remove any 'term' report formats from pytest-cov options.
    This prevents pytest-cov from printing its default terminal coverage table,
    while still allowing it to generate the .coverage data file.
    """
    try:
        if hasattr(config.option, "cov_report"):
            config.option.cov_report = [
                r for r in config.option.cov_report
                if not r.startswith("term")
            ]
    except Exception:
        pass


@pytest.hookimpl(trylast=True)
def pytest_terminal_summary(terminalreporter, exitstatus, config):
    """
    Custom coverage report printed after all tests finish.

    Reads the .coverage data file, filters to app-specific source files
    (excluding test files), and prints:
      1. A per-file table: path | stmts | missing | pct% | [bar]
      2. A TOTAL summary row
      3. A "Top-N files to focus on" or "All files fully covered" footer
    """
    cov_file = os.path.join(os.path.dirname(__file__), ".coverage")
    if not os.path.exists(cov_file):
        return

    try:
        cov = coverage_module.Coverage(data_file=cov_file)
        cov.load()
    except Exception:
        return

    results = []
    try:
        measured = cov.get_data().measured_files()
    except Exception:
        return

    for filepath in measured:
        norm = filepath.replace("\\", "/")
        if "core_app" not in norm or "/tests/" in norm:
            continue
        try:
            analysis = cov._analyze(filepath)
            stmts = len(analysis.statements)
            if stmts == 0:
                continue
            missing = len(analysis.missing)
            pct = (stmts - missing) / stmts * 100
            idx = norm.find("core_app")
            short = norm[idx:] if idx >= 0 else norm
            results.append(
                {
                    "path": short,
                    "stmts": stmts,
                    "missing": missing,
                    "pct": pct,
                    "missing_lines": list(analysis.missing),
                }
            )
        except Exception:
            continue

    if not results:
        return

    results.sort(key=lambda r: r["path"])

    total_stmts = sum(r["stmts"] for r in results)
    total_missing = sum(r["missing"] for r in results)
    total_pct = (total_stmts - total_missing) / total_stmts * 100 if total_stmts > 0 else 0

    # Top-N: up to 3 files with the lowest coverage (only those with missing lines)
    top_n = sorted(
        [r for r in results if r["missing"] > 0],
        key=lambda x: (x["pct"], -x["missing"]),
    )[:3]

    # Calculate dynamic column width based on terminal width
    try:
        term_w = terminalreporter._tw._width
    except AttributeError:
        import shutil
        term_w = shutil.get_terminal_size().columns

    # fixed cols: 2 indent + 2 sep + 5 stmts + 2 sep + 4 miss + 2 sep + 7 pct% + 2 sep + 1 [ + MINI_W + 1 ]
    _FIXED = 2 + 2 + 5 + 2 + 4 + 2 + 7 + 2 + 1 + _MINI_W + 1
    max_path_w = max(term_w - _FIXED - 2, 20)  # -2 safety margin
    actual_max = max((len(r["path"]) for r in results), default=40)
    path_w = min(max_path_w, actual_max)
    path_w = max(path_w, 20)

    for r in results:
        if len(r["path"]) > path_w:
            r["path"] = r["path"][: path_w - 1] + "…"

    # ── Section 1: Per-file table ──
    tw = terminalreporter
    tw.write_sep("=", "COVERAGE REPORT", bold=True)
    tw.write("\n")

    for r in results:
        color = _color_for(r["pct"])
        mini = _bar(r["pct"], _MINI_W)
        tw.write(f"  {r['path']:<{path_w}}  {r['stmts']:>5}  {r['missing']:>4}  ")
        tw.write(f"{r['pct']:>6.1f}%  ", **{color: True})
        tw.write("[")
        tw.write(mini, **{color: True})
        tw.write("]\n")

    # ── Section 2: TOTAL row ──
    tw.write("\n")
    c = _color_for(total_pct)
    wide = _bar(total_pct, _WIDE_W)
    tw.write(f"  {'TOTAL':<{path_w}}  {total_stmts:>5}  {total_missing:>4}  ", bold=True)
    tw.write(f"{total_pct:>6.1f}%  ", bold=True, **{c: True})
    tw.write("[", bold=True)
    tw.write(wide, bold=True, **{c: True})
    tw.write("]\n\n", bold=True)

    # ── Section 3: Focus footer ──
    dash = "─" * 10
    n = len(top_n)
    label = f"Top-{n} files to focus on" if top_n else "All files fully covered"
    tw.write(f"  {dash}  {label}  ", bold=True)
    tw.write(f"(total project: {total_pct:.1f}%)  ", bold=True)
    tw.write(f"{dash}\n", bold=True)

    if not top_n:
        tw.write("\n", green=True)
    else:
        for i, r in enumerate(top_n, 1):
            color = _color_for(r["pct"])
            mini = _bar(r["pct"], _MINI_W)
            tw.write(f"  {i}.  ")
            tw.write(f"{r['pct']:>5.1f}%", **{color: True})
            tw.write("  [")
            tw.write(mini, **{color: True})
            tw.write(f"]  {r['path']}")
            tw.write(f"   ({r['missing']} lines uncovered)\n")
        tw.write("\n")
