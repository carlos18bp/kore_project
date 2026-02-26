"""Tests for run-tests-all-suites helpers."""

from __future__ import annotations

import importlib.util
import sys
from functools import partial
from pathlib import Path
from types import SimpleNamespace

REPO_ROOT = Path(__file__).resolve().parents[4]
SCRIPT_PATH = REPO_ROOT / "scripts" / "run-tests-all-suites.py"

SPEC = importlib.util.spec_from_file_location("run_tests_all_suites", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise ImportError("Unable to load run-tests-all-suites module.")
run_tests_all_suites = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = run_tests_all_suites
SPEC.loader.exec_module(run_tests_all_suites)


def _noop_runner(name: str) -> run_tests_all_suites.StepResult:
    return run_tests_all_suites.StepResult(
        name=name,
        command=["/bin/true"],
        returncode=0,
        duration=0.0,
        status="ok",
    )


def test_build_parser_defaults_to_sequential():
    """Defaults to sequential execution when no flags are provided."""
    parser = run_tests_all_suites.build_parser()
    args = parser.parse_args([])

    assert args.parallel is False


def test_build_parser_allows_verbose_flag():
    """Sets verbose output when --verbose is supplied."""
    parser = run_tests_all_suites.build_parser()
    args = parser.parse_args(["--verbose"])

    assert args.verbose is True
    assert args.quiet is False


def test_build_parser_allows_quiet_flag():
    """Sets quiet output when --quiet is supplied."""
    parser = run_tests_all_suites.build_parser()
    args = parser.parse_args(["--quiet"])

    assert args.quiet is True
    assert args.verbose is False


def test_resolve_resume_status_uses_valid_status():
    """Uses the stored status when the resume record is valid."""
    record = {"status": "ok", "returncode": 1}

    assert run_tests_all_suites.resolve_resume_status(record) == "ok"


def test_resolve_resume_status_uses_returncode_when_status_invalid():
    """Falls back to returncode when resume status is invalid."""
    record = {"status": "corrupt", "returncode": 1}

    assert run_tests_all_suites.resolve_resume_status(record) == "failed"


def test_resolve_resume_status_returns_unknown_when_missing_fields():
    """Returns unknown when resume record lacks required fields."""
    record = {}

    assert run_tests_all_suites.resolve_resume_status(record) == "unknown"


def test_select_suites_for_resume_returns_failed_only():
    """Selects only failed suites when resuming."""
    suite_runners = [
        ("backend", partial(_noop_runner, "backend")),
        ("frontend-unit", partial(_noop_runner, "frontend-unit")),
    ]
    resume_state = {
        "suites": {
            "backend": {"status": "ok"},
            "frontend-unit": {"status": "failed"},
        }
    }

    selected, all_passed = run_tests_all_suites.select_suites_for_resume(
        suite_runners,
        resume_state,
    )

    assert len(selected) == 1
    assert selected[0][0] == "frontend-unit"
    assert all_passed is False


def test_select_suites_for_resume_marks_every_suite_ok():
    """Returns no suites when all recorded suites passed."""
    suite_runners = [
        ("backend", partial(_noop_runner, "backend")),
        ("frontend-unit", partial(_noop_runner, "frontend-unit")),
    ]
    resume_state = {
        "suites": {
            "backend": {"status": "ok"},
            "frontend-unit": {"status": "ok"},
        }
    }

    selected, all_passed = run_tests_all_suites.select_suites_for_resume(
        suite_runners,
        resume_state,
    )

    assert selected == []
    assert all_passed is True


def test_clear_suite_logs_removes_known_files(tmp_path):
    """Removes existing suite log files from the report directory."""
    report_dir = tmp_path / "reports"
    report_dir.mkdir()
    backend_log = report_dir / "backend.log"
    unit_log = report_dir / "frontend-unit.log"
    e2e_log = report_dir / "frontend-e2e.log"

    backend_log.write_text("backend")
    unit_log.write_text("unit")
    e2e_log.write_text("e2e")

    run_tests_all_suites.clear_suite_logs(
        report_dir,
        ["backend", "frontend-unit", "frontend-e2e"],
    )

    assert not backend_log.exists()
    assert not unit_log.exists()
    assert not e2e_log.exists()


def test_build_log_separator_includes_run_metadata():
    """Includes run metadata in the log separator."""
    separator = run_tests_all_suites.build_log_separator(
        "run123",
        "backend",
        ["pytest", "-k", "test_example"],
    )

    assert "Run ID: run123" in separator
    assert "Suite: backend" in separator
    assert "Command: pytest -k test_example" in separator


def test_record_suite_result_persists_run_id(tmp_path):
    """Persists the run id when saving suite results."""
    resume_path = tmp_path / "reports" / "last-run.json"
    result = run_tests_all_suites.StepResult(
        name="backend",
        command=["pytest"],
        returncode=0,
        duration=0.3,
        status="ok",
    )

    state = run_tests_all_suites.record_suite_result(
        resume_path,
        None,
        result,
        run_id="run-abc",
    )

    assert state["run_id"] == "run-abc"
    saved = run_tests_all_suites.load_resume_state(resume_path)
    assert saved["run_id"] == "run-abc"


def test_read_backend_summary_returns_empty_without_data_file(tmp_path):
    """Returns empty summary when no data file is present."""
    summary = run_tests_all_suites.read_backend_coverage_summary(tmp_path)

    assert summary == []


def test_read_backend_summary_aggregates_statement_total(tmp_path, monkeypatch):
    """Aggregates statement totals from core app data only."""
    (tmp_path / ".coverage").write_text("data", encoding="utf-8")
    valid_path = str(tmp_path / "core_app" / "services" / "payments.py")
    ignored_test_path = str(tmp_path / "core_app" / "tests" / "test_payments.py")
    ignored_other_path = str(tmp_path / "other" / "module.py")

    class FakeCoverageData:
        def measured_files(self):
            return [valid_path, ignored_test_path, ignored_other_path]

    class FakeRegion:
        def __init__(self, kind, lines):
            self.kind = kind
            self.lines = lines

    class FakeCoverage:
        def __init__(self, data_file):
            self._data = FakeCoverageData()

        def load(self):
            return None

        def get_data(self):
            return self._data

        def _analyze(self, filepath):
            if filepath != valid_path:
                raise AssertionError("Unexpected analysis request")
            return SimpleNamespace(
                executed={1},
                numbers=SimpleNamespace(
                    n_statements=4,
                    n_missing=1,
                    n_branches=2,
                    n_missing_branches=1,
                ),
            )

        def _get_file_reporter(self, filepath):
            if filepath != valid_path:
                raise AssertionError("Unexpected reporter request")
            return SimpleNamespace(
                code_regions=lambda: [
                    FakeRegion("function", {1, 2}),
                    FakeRegion("function", {3, 4}),
                ]
            )

    monkeypatch.setitem(sys.modules, "coverage", SimpleNamespace(Coverage=FakeCoverage))

    summary = run_tests_all_suites.read_backend_coverage_summary(tmp_path)

    assert summary == [
        "Statements: 75.00% (3/4)",
        "Branches: 50.00% (1/2)",
        "Functions: 50.00% (1/2)",
        "Lines: 75.00% (3/4)",
        "Total: 66.67%",
    ]


def test_run_backend_erases_data_when_flag_set(tmp_path, monkeypatch):
    """Erases existing data when the flag is enabled."""
    erased = []
    captured = {}

    def fake_erase(root):
        erased.append(root)

    def fake_run_command(**kwargs):
        captured.update(kwargs)
        return run_tests_all_suites.StepResult(
            name="backend",
            command=kwargs.get("command", []),
            returncode=0,
            duration=0.0,
            status="ok",
        )

    monkeypatch.setattr(run_tests_all_suites, "erase_backend_coverage_data", fake_erase)
    monkeypatch.setattr(run_tests_all_suites, "run_command", fake_run_command)

    run_tests_all_suites.run_backend(
        backend_root=tmp_path,
        report_dir=tmp_path,
        markers="",
        extra_args=[],
        quiet=True,
        append_log=False,
        run_id=None,
        show_coverage=True,
    )

    assert erased == [tmp_path]
    assert "--cov-branch" in captured["command"]
    assert "--cov-report=term-missing" in captured["command"]


def test_run_backend_skips_erase_without_flag(tmp_path, monkeypatch):
    """Skips erasing data when the flag is disabled."""
    erased = []

    def fake_erase(root):
        erased.append(root)

    def fake_run_command(**kwargs):
        return run_tests_all_suites.StepResult(
            name="backend",
            command=kwargs.get("command", []),
            returncode=0,
            duration=0.0,
            status="ok",
        )

    monkeypatch.setattr(run_tests_all_suites, "erase_backend_coverage_data", fake_erase)
    monkeypatch.setattr(run_tests_all_suites, "run_command", fake_run_command)

    run_tests_all_suites.run_backend(
        backend_root=tmp_path,
        report_dir=tmp_path,
        markers="",
        extra_args=[],
        quiet=True,
        append_log=False,
        run_id=None,
        show_coverage=False,
    )

    assert erased == []
