#!/usr/bin/env python3
"""
Test Quality Gate - Enhanced Edition.

Detects low-quality tests automatically by analyzing code patterns,
structure, and common anti-patterns in test suites.

Quality checks performed:
    - Empty or trivial tests (pass, ..., no body)
    - Missing assertions
    - Useless assertions (assert True, assert 1)
    - Vague assertions (assert obj without specific checks)
    - Generic/poor naming (test_1, test_it, test_something)
    - Tests that are too long (>50 lines) or too short (<3 lines)
    - Too many assertions (>7 per test)
    - Sleep calls (flaky test indicator)
    - Residual print statements (forgotten debugging)
    - Silent try/except blocks (hiding failures)
    - Excessive mocking (>5 patches)
    - Unverified mocks (Mock without assert_called*)
    - Missing docstrings on complex tests
    - Duplicate test names
    - Forbidden naming tokens
    - Misplaced test files

Usage:
    python test_quality_gate.py --repo-root /path/to/repo
    python test_quality_gate.py --repo-root . --verbose --strict

Exit codes:
    0 - All validations passed (or only info-level issues in non-strict mode)
    1 - Errors or warnings found
    2 - Configuration or runtime error
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from abc import ABC, abstractmethod
from collections import Counter
from dataclasses import dataclass, field, asdict
from enum import Enum, auto
from pathlib import Path
from typing import Any, Iterator, Callable


# =============================================================================
# Constants and Configuration
# =============================================================================

class Severity(Enum):
    """Severity levels for quality issues."""
    
    ERROR = "error"      # Must fix - blocks commit
    WARNING = "warning"  # Should fix - may block in strict mode  
    INFO = "info"        # Consider fixing - never blocks
    
    def __lt__(self, other: "Severity") -> bool:
        order = {Severity.INFO: 0, Severity.WARNING: 1, Severity.ERROR: 2}
        return order[self] < order[other]


class IssueCategory(Enum):
    """Categories of quality issues for reporting."""
    
    EMPTY_TEST = auto()
    NO_ASSERTIONS = auto()
    USELESS_ASSERTION = auto()
    VAGUE_ASSERTION = auto()
    POOR_NAMING = auto()
    TEST_TOO_LONG = auto()
    TEST_TOO_SHORT = auto()
    TOO_MANY_ASSERTIONS = auto()
    SLEEP_CALL = auto()
    PRINT_STATEMENT = auto()
    SILENT_EXCEPTION = auto()
    EXCESSIVE_MOCKING = auto()
    UNVERIFIED_MOCK = auto()
    MISSING_DOCSTRING = auto()
    DUPLICATE_NAME = auto()
    FORBIDDEN_TOKEN = auto()
    MISPLACED_FILE = auto()
    PARSE_ERROR = auto()


class Colors:
    """ANSI color codes for terminal output."""
    
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"
    
    @classmethod
    def disable(cls) -> None:
        """Disable all colors."""
        for attr in ['RED', 'GREEN', 'YELLOW', 'BLUE', 'MAGENTA', 'CYAN', 'BOLD', 'DIM', 'RESET']:
            setattr(cls, attr, '')
    
    @classmethod
    def severity(cls, sev: Severity) -> str:
        """Get color for severity level."""
        return {
            Severity.ERROR: cls.RED,
            Severity.WARNING: cls.YELLOW,
            Severity.INFO: cls.CYAN,
        }[sev]


@dataclass(frozen=True)
class Config:
    """
    Configuration for test quality scanning.
    
    Thresholds and patterns can be customized per project.
    """
    
    # File discovery
    backend_app_name: str = "gym_app"
    py_allowed_folders: frozenset[str] = frozenset({"models", "serializers", "views", "utils", "tasks"})
    py_test_file_glob: str = "test_*.py"
    js_unit_suffixes: tuple[str, ...] = (".test.js", ".spec.js", ".test.ts", ".spec.ts")
    js_e2e_suffixes: tuple[str, ...] = (".spec.js", ".spec.ts")
    
    # Naming
    banned_tokens: tuple[str, ...] = ("batch", "coverage", "cov", "deep")
    generic_test_names: tuple[str, ...] = (
        "test_1", "test_2", "test_3", "test_it", "test_this", "test_that",
        "test_something", "test_stuff", "test_thing", "test_test", "test_foo",
        "test_bar", "test_baz", "test_example", "test_sample", "test_demo",
        "test_temp", "test_tmp", "test_x", "test_y", "test_z", "test_a", "test_b",
    )
    
    # Quality thresholds
    max_test_lines: int = 50
    min_test_lines: int = 3
    max_assertions_per_test: int = 7
    max_patches_per_test: int = 5
    min_lines_for_docstring: int = 15
    
    # Patterns to detect
    useless_assertions: tuple[str, ...] = (
        "assert True", "assert 1", "assert not False", "assert not 0",
        "self.assertTrue(True)", "self.assertFalse(False)",
        "expect(true).toBe(true)", "expect(1).toBe(1)",
    )


DEFAULT_CONFIG = Config()


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class Issue:
    """
    Represents a single quality issue found in a test.
    
    Attributes:
        file: Relative path to the file.
        message: Human-readable description.
        line: Line number (if applicable).
        severity: ERROR, WARNING, or INFO.
        category: Type of issue for grouping.
        identifier: The specific test name/element.
        suggestion: How to fix the issue.
    """
    
    file: str
    message: str
    severity: Severity
    category: IssueCategory
    line: int | None = None
    identifier: str | None = None
    suggestion: str | None = None
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "file": self.file,
            "message": self.message,
            "severity": self.severity.value,
            "category": self.category.name.lower(),
        }
        if self.line:
            result["line"] = self.line
        if self.identifier:
            result["identifier"] = self.identifier
        if self.suggestion:
            result["suggestion"] = self.suggestion
        return result


@dataclass
class TestInfo:
    """
    Information about a single test function/method.
    
    Used for detailed quality analysis.
    """
    
    name: str
    lineno: int
    end_lineno: int
    num_lines: int
    num_assertions: int = 0
    num_patches: int = 0
    has_docstring: bool = False
    has_sleep: bool = False
    has_print: bool = False
    has_silent_except: bool = False
    has_unverified_mock: bool = False
    is_empty: bool = False
    assertions: list[str] = field(default_factory=list)


@dataclass
class FileResult:
    """Result of analyzing a single test file."""
    
    file: str
    area: str
    location_ok: bool
    tests: list[TestInfo] = field(default_factory=list)
    issues: list[Issue] = field(default_factory=list)
    
    @property
    def test_count(self) -> int:
        return len(self.tests)
    
    @property
    def issue_count(self) -> int:
        return len(self.issues)
    
    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == Severity.ERROR)
    
    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == Severity.WARNING)


@dataclass 
class SuiteResult:
    """Result of analyzing a test suite."""
    
    suite_name: str
    files: list[FileResult] = field(default_factory=list)
    
    @property
    def file_count(self) -> int:
        return len(self.files)
    
    @property
    def test_count(self) -> int:
        return sum(f.test_count for f in self.files)
    
    @property
    def all_issues(self) -> list[Issue]:
        return [i for f in self.files for i in f.issues]
    
    @property
    def error_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == Severity.ERROR)
    
    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == Severity.WARNING)
    
    @property
    def info_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == Severity.INFO)
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "files": self.file_count,
            "tests": self.test_count,
            "errors": self.error_count,
            "warnings": self.warning_count,
            "info": self.info_count,
            "issues": [i.to_dict() for i in self.all_issues],
            "file_details": [
                {
                    "file": f.file,
                    "area": f.area,
                    "location_ok": f.location_ok,
                    "tests": f.test_count,
                    "issues": f.issue_count,
                }
                for f in self.files
            ],
        }


# =============================================================================
# AST Analysis Utilities
# =============================================================================

class ASTAnalyzer:
    """
    Utility class for analyzing Python AST nodes.
    
    Provides methods to extract information about test functions,
    detect patterns, and count specific constructs.
    """
    
    # Assertion method names (pytest and unittest)
    ASSERTION_PATTERNS = {
        # pytest
        "assert",
        # unittest
        "assertEqual", "assertNotEqual", "assertTrue", "assertFalse",
        "assertIs", "assertIsNot", "assertIsNone", "assertIsNotNone",
        "assertIn", "assertNotIn", "assertIsInstance", "assertNotIsInstance",
        "assertRaises", "assertWarns", "assertAlmostEqual", "assertNotAlmostEqual",
        "assertGreater", "assertGreaterEqual", "assertLess", "assertLessEqual",
        "assertRegex", "assertNotRegex", "assertCountEqual",
        # DRF
        "assertContains", "assertNotContains", "assertRedirects",
        "assertTemplateUsed", "assertTemplateNotUsed",
    }
    
    # Mock assertion methods
    MOCK_ASSERTIONS = {
        "assert_called", "assert_called_once", "assert_called_with",
        "assert_called_once_with", "assert_any_call", "assert_has_calls",
        "assert_not_called",
    }
    
    @classmethod
    def get_function_lines(cls, node: ast.FunctionDef) -> int:
        """Get the number of lines in a function."""
        if node.end_lineno:
            return node.end_lineno - node.lineno + 1
        return 1
    
    @classmethod
    def has_docstring(cls, node: ast.FunctionDef) -> bool:
        """Check if a function has a docstring."""
        if not node.body:
            return False
        first = node.body[0]
        if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant):
            return isinstance(first.value.value, str)
        return False
    
    @classmethod
    def is_empty_body(cls, node: ast.FunctionDef) -> bool:
        """
        Check if a function body is effectively empty.
        
        Empty means: only pass, ..., docstring, or comments.
        """
        meaningful_stmts = []
        for stmt in node.body:
            # Skip docstring
            if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant):
                if isinstance(stmt.value.value, str):
                    continue
            # Skip pass
            if isinstance(stmt, ast.Pass):
                continue
            # Skip ellipsis (...)
            if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant):
                if stmt.value.value is ...:
                    continue
            meaningful_stmts.append(stmt)
        
        return len(meaningful_stmts) == 0
    
    @classmethod
    def count_assertions(cls, node: ast.FunctionDef) -> tuple[int, list[str]]:
        """
        Count assertions in a function and return assertion strings.
        
        Returns:
            Tuple of (count, list of assertion source representations).
        """
        assertions = []
        
        for child in ast.walk(node):
            # pytest assert
            if isinstance(child, ast.Assert):
                assertions.append(ast.unparse(child) if hasattr(ast, 'unparse') else "assert ...")
            
            # unittest self.assert*
            elif isinstance(child, ast.Call):
                if isinstance(child.func, ast.Attribute):
                    if child.func.attr in cls.ASSERTION_PATTERNS:
                        assertions.append(child.func.attr)
        
        return len(assertions), assertions
    
    @classmethod
    def count_patches(cls, node: ast.FunctionDef) -> int:
        """Count @patch decorators on a function."""
        count = 0
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Call):
                if isinstance(decorator.func, ast.Attribute):
                    if decorator.func.attr in ("patch", "patch.object"):
                        count += 1
                elif isinstance(decorator.func, ast.Name):
                    if decorator.func.id == "patch":
                        count += 1
            elif isinstance(decorator, ast.Attribute):
                if decorator.attr == "patch":
                    count += 1
        return count
    
    @classmethod
    def has_sleep_call(cls, node: ast.FunctionDef) -> bool:
        """Check if function contains time.sleep() calls."""
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                # time.sleep()
                if isinstance(child.func, ast.Attribute):
                    if child.func.attr == "sleep":
                        return True
                # from time import sleep; sleep()
                elif isinstance(child.func, ast.Name):
                    if child.func.id == "sleep":
                        return True
        return False
    
    @classmethod
    def has_print_call(cls, node: ast.FunctionDef) -> bool:
        """Check if function contains print() calls."""
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Name) and child.func.id == "print":
                    return True
        return False
    
    @classmethod
    def has_silent_except(cls, node: ast.FunctionDef) -> bool:
        """
        Check if function has try/except that silently catches exceptions.
        
        Silent = except block with only pass, continue, or nothing meaningful.
        """
        for child in ast.walk(node):
            if isinstance(child, ast.ExceptHandler):
                # Check if handler body is effectively empty
                body_empty = all(
                    isinstance(stmt, (ast.Pass, ast.Continue)) or
                    (isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant))
                    for stmt in child.body
                )
                if body_empty:
                    return True
        return False
    
    @classmethod
    def has_unverified_mock(cls, node: ast.FunctionDef) -> bool:
        """
        Check if function creates mocks but never verifies them.
        
        Looks for Mock(), MagicMock() without corresponding assert_called*.
        """
        has_mock_creation = False
        has_mock_assertion = False
        
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                # Check for Mock() or MagicMock()
                if isinstance(child.func, ast.Name):
                    if child.func.id in ("Mock", "MagicMock"):
                        has_mock_creation = True
                elif isinstance(child.func, ast.Attribute):
                    if child.func.attr in ("Mock", "MagicMock"):
                        has_mock_creation = True
                    # Check for mock assertions
                    if child.func.attr in cls.MOCK_ASSERTIONS:
                        has_mock_assertion = True
        
        return has_mock_creation and not has_mock_assertion
    
    @classmethod
    def get_vague_assertions(cls, node: ast.FunctionDef) -> list[int]:
        """
        Find vague assertions that just check truthiness.
        
        Examples: assert response, assert result, self.assertTrue(obj)
        
        Returns:
            List of line numbers with vague assertions.
        """
        vague_lines = []
        
        for child in ast.walk(node):
            if isinstance(child, ast.Assert):
                test = child.test
                # assert <name> (single variable)
                if isinstance(test, ast.Name):
                    vague_lines.append(child.lineno)
                # assert <attr> (single attribute)
                elif isinstance(test, ast.Attribute):
                    vague_lines.append(child.lineno)
        
        return vague_lines


# =============================================================================
# Regex Patterns
# =============================================================================

class Patterns:
    """Compiled regex patterns for test analysis."""
    
    def __init__(self, config: Config) -> None:
        self.config = config
        self._compile()
    
    def _compile(self) -> None:
        """Compile all patterns."""
        # Banned tokens in class names
        tokens = "|".join(
            f"{t}(?!er)" if t.lower() == "cov" else t
            for t in self.config.banned_tokens
        )
        self.py_class_banned = re.compile(f"({tokens})", re.IGNORECASE)
        
        # Banned tokens in function names
        func_tokens = "|".join(self.config.banned_tokens)
        self.py_func_banned = re.compile(rf"(?:^|_)({func_tokens})(?:_|$)", re.IGNORECASE)
        
        # Banned tokens in JS titles
        self.js_title_banned = re.compile(rf"\b({func_tokens})\b", re.IGNORECASE)
        
        # Banned tokens in file names
        self.file_banned = re.compile(rf"(^|[-_])({func_tokens})([-_.\d]|$)", re.IGNORECASE)
        
        # JS test calls
        self.js_call = re.compile(r"\b(?:it|test|describe)\s*\(\s*([`\"'])(.*?)\1", re.DOTALL)
        
        # Generic test name pattern
        generic = "|".join(re.escape(n) for n in self.config.generic_test_names)
        self.generic_name = re.compile(rf"^({generic})$", re.IGNORECASE)
        
        # Very short names (test_ + 1-2 chars)
        self.too_short_name = re.compile(r"^test_[a-z]{1,2}$", re.IGNORECASE)
        
        # Useless assertion patterns for source matching
        useless = "|".join(re.escape(u) for u in self.config.useless_assertions)
        self.useless_assertion = re.compile(rf"({useless})", re.IGNORECASE)


# =============================================================================
# Python Test Analyzer
# =============================================================================

class PythonAnalyzer:
    """
    Analyzes Python test files for quality issues.
    """
    
    def __init__(self, repo_root: Path, config: Config, patterns: Patterns, verbose: bool = False):
        self.repo_root = repo_root
        self.config = config
        self.patterns = patterns
        self.verbose = verbose
    
    def _rel(self, path: Path) -> str:
        return path.relative_to(self.repo_root).as_posix()
    
    def _log(self, msg: str) -> None:
        if self.verbose:
            print(f"  {Colors.DIM}→{Colors.RESET} {msg}")
    
    def analyze_suite(self, tests_root: Path) -> SuiteResult:
        """Analyze all Python test files in a directory."""
        result = SuiteResult(suite_name="backend")
        
        if not tests_root.exists():
            self._log(f"Directory not found: {tests_root}")
            return result
        
        for path in sorted(tests_root.rglob(self.config.py_test_file_glob)):
            file_result = self._analyze_file(path, tests_root)
            result.files.append(file_result)
        
        return result
    
    def _analyze_file(self, path: Path, tests_root: Path) -> FileResult:
        """Analyze a single Python test file."""
        rel_path = self._rel(path)
        self._log(f"Analyzing: {rel_path}")
        
        # Determine area and location validity
        relative = path.relative_to(tests_root)
        area = relative.parts[0] if len(relative.parts) > 1 else ""
        location_ok = area in self.config.py_allowed_folders
        
        file_result = FileResult(file=rel_path, area=area, location_ok=location_ok)
        
        # Check location
        if not location_ok:
            file_result.issues.append(Issue(
                file=rel_path,
                message=f"Test file in wrong location (area='{area}')",
                severity=Severity.ERROR,
                category=IssueCategory.MISPLACED_FILE,
                suggestion=f"Move to one of: {sorted(self.config.py_allowed_folders)}",
            ))
        
        # Check file name
        if self.patterns.file_banned.search(path.name):
            file_result.issues.append(Issue(
                file=rel_path,
                message=f"Forbidden token in file name: {path.name}",
                severity=Severity.ERROR,
                category=IssueCategory.FORBIDDEN_TOKEN,
                identifier=path.name,
            ))
        
        # Parse file
        try:
            source = path.read_text(encoding="utf-8")
            tree = ast.parse(source, filename=str(path))
        except SyntaxError as e:
            file_result.issues.append(Issue(
                file=rel_path,
                message=f"Syntax error: {e.msg}",
                severity=Severity.ERROR,
                category=IssueCategory.PARSE_ERROR,
                line=e.lineno,
            ))
            return file_result
        except Exception as e:
            file_result.issues.append(Issue(
                file=rel_path,
                message=f"Parse error: {e}",
                severity=Severity.ERROR,
                category=IssueCategory.PARSE_ERROR,
            ))
            return file_result
        
        # Track names for duplicate detection
        module_names: dict[str, list[int]] = {}
        
        # Analyze module-level functions
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and node.name.startswith("test_"):
                module_names.setdefault(node.name, []).append(node.lineno)
                test_info = self._analyze_test_function(node, rel_path, file_result)
                file_result.tests.append(test_info)
        
        # Check for module-level duplicates
        for name, lines in module_names.items():
            if len(lines) > 1:
                file_result.issues.append(Issue(
                    file=rel_path,
                    message=f"Duplicate test function: {name}",
                    severity=Severity.ERROR,
                    category=IssueCategory.DUPLICATE_NAME,
                    line=lines[0],
                    identifier=name,
                    suggestion=f"Appears on lines {lines}. Rename or merge.",
                ))
        
        # Analyze classes
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                self._analyze_test_class(node, rel_path, file_result, source)
        
        return file_result
    
    def _analyze_test_function(
        self, 
        node: ast.FunctionDef, 
        file: str, 
        result: FileResult,
        class_name: str | None = None,
    ) -> TestInfo:
        """Analyze a single test function for quality issues."""
        full_name = f"{class_name}.{node.name}" if class_name else node.name
        
        # Basic info
        num_lines = ASTAnalyzer.get_function_lines(node)
        num_assertions, assertions = ASTAnalyzer.count_assertions(node)
        
        test_info = TestInfo(
            name=node.name,
            lineno=node.lineno,
            end_lineno=node.end_lineno or node.lineno,
            num_lines=num_lines,
            num_assertions=num_assertions,
            num_patches=ASTAnalyzer.count_patches(node),
            has_docstring=ASTAnalyzer.has_docstring(node),
            has_sleep=ASTAnalyzer.has_sleep_call(node),
            has_print=ASTAnalyzer.has_print_call(node),
            has_silent_except=ASTAnalyzer.has_silent_except(node),
            has_unverified_mock=ASTAnalyzer.has_unverified_mock(node),
            is_empty=ASTAnalyzer.is_empty_body(node),
            assertions=assertions,
        )
        
        # === Quality Checks ===
        
        # 1. Empty test
        if test_info.is_empty:
            result.issues.append(Issue(
                file=file,
                message=f"Empty test (only pass/... or docstring)",
                severity=Severity.ERROR,
                category=IssueCategory.EMPTY_TEST,
                line=node.lineno,
                identifier=full_name,
                suggestion="Add meaningful test logic or remove.",
            ))
        
        # 2. No assertions
        elif num_assertions == 0:
            result.issues.append(Issue(
                file=file,
                message=f"Test has no assertions",
                severity=Severity.ERROR,
                category=IssueCategory.NO_ASSERTIONS,
                line=node.lineno,
                identifier=full_name,
                suggestion="Add assert statements to verify behavior.",
            ))
        
        # 3. Useless assertions
        for assertion in assertions:
            if self.patterns.useless_assertion.search(assertion):
                result.issues.append(Issue(
                    file=file,
                    message=f"Useless assertion: {assertion}",
                    severity=Severity.ERROR,
                    category=IssueCategory.USELESS_ASSERTION,
                    line=node.lineno,
                    identifier=full_name,
                    suggestion="Assert specific values or conditions.",
                ))
        
        # 4. Vague assertions
        vague_lines = ASTAnalyzer.get_vague_assertions(node)
        if vague_lines:
            result.issues.append(Issue(
                file=file,
                message=f"Vague assertion(s) - only checking truthiness",
                severity=Severity.WARNING,
                category=IssueCategory.VAGUE_ASSERTION,
                line=vague_lines[0],
                identifier=full_name,
                suggestion="Assert specific properties (e.g., assert response.status_code == 200).",
            ))
        
        # 5. Poor naming
        if self.patterns.generic_name.match(node.name) or self.patterns.too_short_name.match(node.name):
            result.issues.append(Issue(
                file=file,
                message=f"Generic/poor test name: {node.name}",
                severity=Severity.WARNING,
                category=IssueCategory.POOR_NAMING,
                line=node.lineno,
                identifier=full_name,
                suggestion="Use descriptive name: test_<action>_<condition>_<expected>",
            ))
        
        # 6. Forbidden tokens in name
        if self.patterns.py_func_banned.search(node.name):
            result.issues.append(Issue(
                file=file,
                message=f"Forbidden token in test name: {node.name}",
                severity=Severity.ERROR,
                category=IssueCategory.FORBIDDEN_TOKEN,
                line=node.lineno,
                identifier=full_name,
            ))
        
        # 7. Test too long
        if num_lines > self.config.max_test_lines:
            result.issues.append(Issue(
                file=file,
                message=f"Test too long ({num_lines} lines > {self.config.max_test_lines})",
                severity=Severity.WARNING,
                category=IssueCategory.TEST_TOO_LONG,
                line=node.lineno,
                identifier=full_name,
                suggestion="Split into smaller, focused tests.",
            ))
        
        # 8. Test too short (but not empty)
        if num_lines < self.config.min_test_lines and not test_info.is_empty:
            result.issues.append(Issue(
                file=file,
                message=f"Test suspiciously short ({num_lines} lines)",
                severity=Severity.INFO,
                category=IssueCategory.TEST_TOO_SHORT,
                line=node.lineno,
                identifier=full_name,
                suggestion="Ensure test is meaningful and complete.",
            ))
        
        # 9. Too many assertions
        if num_assertions > self.config.max_assertions_per_test:
            result.issues.append(Issue(
                file=file,
                message=f"Too many assertions ({num_assertions} > {self.config.max_assertions_per_test})",
                severity=Severity.WARNING,
                category=IssueCategory.TOO_MANY_ASSERTIONS,
                line=node.lineno,
                identifier=full_name,
                suggestion="Split into multiple focused tests.",
            ))
        
        # 10. Sleep call (flaky test)
        if test_info.has_sleep:
            result.issues.append(Issue(
                file=file,
                message="Test uses sleep() - likely flaky",
                severity=Severity.ERROR,
                category=IssueCategory.SLEEP_CALL,
                line=node.lineno,
                identifier=full_name,
                suggestion="Use mocking or async waiting instead.",
            ))
        
        # 11. Print statement (forgotten debug)
        if test_info.has_print:
            result.issues.append(Issue(
                file=file,
                message="Test contains print() - forgotten debug?",
                severity=Severity.WARNING,
                category=IssueCategory.PRINT_STATEMENT,
                line=node.lineno,
                identifier=full_name,
                suggestion="Remove print statements or use logging.",
            ))
        
        # 12. Silent exception handler
        if test_info.has_silent_except:
            result.issues.append(Issue(
                file=file,
                message="Test has silent try/except - may hide failures",
                severity=Severity.ERROR,
                category=IssueCategory.SILENT_EXCEPTION,
                line=node.lineno,
                identifier=full_name,
                suggestion="Re-raise exceptions or use pytest.raises().",
            ))
        
        # 13. Excessive mocking
        if test_info.num_patches > self.config.max_patches_per_test:
            result.issues.append(Issue(
                file=file,
                message=f"Excessive mocking ({test_info.num_patches} patches)",
                severity=Severity.WARNING,
                category=IssueCategory.EXCESSIVE_MOCKING,
                line=node.lineno,
                identifier=full_name,
                suggestion="Consider integration test or refactor code.",
            ))
        
        # 14. Unverified mock
        if test_info.has_unverified_mock:
            result.issues.append(Issue(
                file=file,
                message="Mock created but never verified",
                severity=Severity.WARNING,
                category=IssueCategory.UNVERIFIED_MOCK,
                line=node.lineno,
                identifier=full_name,
                suggestion="Add mock.assert_called*() verification.",
            ))
        
        # 15. Missing docstring on complex test
        if num_lines >= self.config.min_lines_for_docstring and not test_info.has_docstring:
            result.issues.append(Issue(
                file=file,
                message=f"Complex test ({num_lines} lines) lacks docstring",
                severity=Severity.INFO,
                category=IssueCategory.MISSING_DOCSTRING,
                line=node.lineno,
                identifier=full_name,
                suggestion="Add docstring explaining what is being tested.",
            ))
        
        return test_info
    
    def _analyze_test_class(
        self, 
        cls: ast.ClassDef, 
        file: str, 
        result: FileResult,
        source: str,
    ) -> None:
        """Analyze a test class and its methods."""
        # Check class name for forbidden tokens
        if cls.name.startswith("Test") and self.patterns.py_class_banned.search(cls.name):
            result.issues.append(Issue(
                file=file,
                message=f"Forbidden token in class name: {cls.name}",
                severity=Severity.ERROR,
                category=IssueCategory.FORBIDDEN_TOKEN,
                line=cls.lineno,
                identifier=cls.name,
            ))
        
        # Track method names for duplicates
        method_names: dict[str, list[int]] = {}
        
        for node in cls.body:
            if isinstance(node, ast.FunctionDef) and node.name.startswith("test_"):
                method_names.setdefault(node.name, []).append(node.lineno)
                test_info = self._analyze_test_function(node, file, result, cls.name)
                result.tests.append(test_info)
        
        # Check for duplicates within class
        for name, lines in method_names.items():
            if len(lines) > 1:
                result.issues.append(Issue(
                    file=file,
                    message=f"Duplicate method in {cls.name}: {name}",
                    severity=Severity.ERROR,
                    category=IssueCategory.DUPLICATE_NAME,
                    line=lines[0],
                    identifier=f"{cls.name}.{name}",
                    suggestion=f"Appears on lines {lines}. Rename or merge.",
                ))


# =============================================================================
# JavaScript Test Analyzer
# =============================================================================

class JavaScriptAnalyzer:
    """Analyzes JavaScript/TypeScript test files for quality issues."""
    
    def __init__(self, repo_root: Path, config: Config, patterns: Patterns, verbose: bool = False):
        self.repo_root = repo_root
        self.config = config
        self.patterns = patterns
        self.verbose = verbose
    
    def _rel(self, path: Path) -> str:
        return path.relative_to(self.repo_root).as_posix()
    
    def _log(self, msg: str) -> None:
        if self.verbose:
            print(f"  {Colors.DIM}→{Colors.RESET} {msg}")
    
    def analyze_suite(self, root: Path, suffixes: tuple[str, ...], name: str) -> SuiteResult:
        """Analyze all JS test files in a directory."""
        result = SuiteResult(suite_name=name)
        
        if not root.exists():
            self._log(f"Directory not found: {root}")
            return result
        
        for path in sorted(root.rglob("*")):
            if path.is_file() and any(path.name.endswith(s) for s in suffixes):
                file_result = self._analyze_file(path, name)
                result.files.append(file_result)
        
        return result
    
    def _analyze_file(self, path: Path, suite_name: str) -> FileResult:
        """Analyze a single JS test file."""
        rel_path = self._rel(path)
        self._log(f"Analyzing: {rel_path}")
        
        file_result = FileResult(file=rel_path, area=suite_name, location_ok=True)
        
        # Check file name
        if self.patterns.file_banned.search(path.name):
            file_result.issues.append(Issue(
                file=rel_path,
                message=f"Forbidden token in file name: {path.name}",
                severity=Severity.ERROR,
                category=IssueCategory.FORBIDDEN_TOKEN,
                identifier=path.name,
            ))
        
        # Read content
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            file_result.issues.append(Issue(
                file=rel_path,
                message=f"Cannot read file: {e}",
                severity=Severity.ERROR,
                category=IssueCategory.PARSE_ERROR,
            ))
            return file_result
        
        # Find all test titles
        titles: dict[str, list[int]] = {}
        
        for match in self.patterns.js_call.finditer(content):
            title = " ".join(match.group(2).split())
            line = content.count("\n", 0, match.start()) + 1
            titles.setdefault(title, []).append(line)
            
            # Create test info
            test_info = TestInfo(
                name=title,
                lineno=line,
                end_lineno=line,
                num_lines=1,
            )
            file_result.tests.append(test_info)
            
            # Check for forbidden tokens
            if self.patterns.js_title_banned.search(title):
                file_result.issues.append(Issue(
                    file=rel_path,
                    message=f"Forbidden token in test title",
                    severity=Severity.ERROR,
                    category=IssueCategory.FORBIDDEN_TOKEN,
                    line=line,
                    identifier=title,
                ))
            
            # Check for generic names
            if title.lower() in ("it works", "should work", "test", "works"):
                file_result.issues.append(Issue(
                    file=rel_path,
                    message=f"Generic test title: '{title}'",
                    severity=Severity.WARNING,
                    category=IssueCategory.POOR_NAMING,
                    line=line,
                    identifier=title,
                    suggestion="Use descriptive title explaining behavior.",
                ))
            
            # Check for useless assertions in content (rough heuristic)
            for useless in self.config.useless_assertions:
                if useless in content and "expect(true)" in title.lower():
                    file_result.issues.append(Issue(
                        file=rel_path,
                        message=f"Likely useless assertion detected",
                        severity=Severity.WARNING,
                        category=IssueCategory.USELESS_ASSERTION,
                        line=line,
                        identifier=title,
                    ))
                    break
        
        # Check for duplicates
        for title, lines in titles.items():
            if len(lines) > 1:
                file_result.issues.append(Issue(
                    file=rel_path,
                    message=f"Duplicate test title: '{title}'",
                    severity=Severity.ERROR,
                    category=IssueCategory.DUPLICATE_NAME,
                    line=lines[0],
                    identifier=title,
                    suggestion=f"Appears on lines {lines}.",
                ))
        
        return file_result


# =============================================================================
# Report Builder
# =============================================================================

class QualityReport:
    """Builds and formats quality reports."""
    
    def __init__(self, repo_root: Path, config: Config = DEFAULT_CONFIG, verbose: bool = False):
        self.repo_root = repo_root
        self.config = config
        self.verbose = verbose
        self.patterns = Patterns(config)
    
    def build(self) -> dict[str, Any]:
        """Build complete quality report."""
        if self.verbose:
            print(f"\n{Colors.BOLD}Test Quality Gate - Enhanced{Colors.RESET}")
            print(f"Repository: {self.repo_root}\n")
        
        # Analyze backend
        if self.verbose:
            print(f"{Colors.BLUE}[Backend Python Tests]{Colors.RESET}")
        
        py_analyzer = PythonAnalyzer(self.repo_root, self.config, self.patterns, self.verbose)
        backend_root = self.repo_root / "backend" / self.config.backend_app_name / "tests"
        backend = py_analyzer.analyze_suite(backend_root)
        
        # Analyze frontend unit
        if self.verbose:
            print(f"\n{Colors.BLUE}[Frontend Unit Tests]{Colors.RESET}")
        
        js_analyzer = JavaScriptAnalyzer(self.repo_root, self.config, self.patterns, self.verbose)
        unit_root = self.repo_root / "frontend" / "test"
        unit = js_analyzer.analyze_suite(unit_root, self.config.js_unit_suffixes, "frontend_unit")
        
        # Analyze frontend E2E
        if self.verbose:
            print(f"\n{Colors.BLUE}[Frontend E2E Tests]{Colors.RESET}")
        
        e2e_root = self.repo_root / "frontend" / "e2e"
        e2e = js_analyzer.analyze_suite(e2e_root, self.config.js_e2e_suffixes, "frontend_e2e")
        
        # Build summary
        all_issues = backend.all_issues + unit.all_issues + e2e.all_issues
        
        # Categorize by severity
        errors = sum(1 for i in all_issues if i.severity == Severity.ERROR)
        warnings = sum(1 for i in all_issues if i.severity == Severity.WARNING)
        infos = sum(1 for i in all_issues if i.severity == Severity.INFO)
        
        # Categorize by type
        by_category = Counter(i.category.name.lower() for i in all_issues)
        
        # Calculate quality score (0-100)
        total_tests = backend.test_count + unit.test_count + e2e.test_count
        if total_tests > 0:
            # Weighted deductions: errors = 10 pts, warnings = 3 pts, info = 1 pt
            deductions = (errors * 10) + (warnings * 3) + (infos * 1)
            max_deduction = total_tests * 10  # Assume worst case
            score = max(0, 100 - int((deductions / max(max_deduction, 1)) * 100))
        else:
            score = 100
        
        return {
            "summary": {
                "total_files": backend.file_count + unit.file_count + e2e.file_count,
                "total_tests": total_tests,
                "errors": errors,
                "warnings": warnings,
                "info": infos,
                "quality_score": score,
                "status": "passed" if errors == 0 else "failed",
                "issues_by_category": dict(by_category),
            },
            "backend": backend.to_dict(),
            "frontend": {
                "unit": unit.to_dict(),
                "e2e": e2e.to_dict(),
            },
        }


def print_report(report: dict[str, Any], show_all: bool = False) -> None:
    """Print formatted report to terminal."""
    summary = report["summary"]
    
    print(f"\n{Colors.BOLD}{'═' * 65}{Colors.RESET}")
    print(f"{Colors.BOLD}  TEST QUALITY REPORT{Colors.RESET}")
    print(f"{'═' * 65}")
    
    # Stats
    print(f"\n{Colors.CYAN}  Statistics:{Colors.RESET}")
    print(f"    Files scanned:  {summary['total_files']}")
    print(f"    Tests found:    {summary['total_tests']}")
    
    # Quality score with color
    score = summary['quality_score']
    if score >= 80:
        score_color = Colors.GREEN
    elif score >= 60:
        score_color = Colors.YELLOW
    else:
        score_color = Colors.RED
    
    print(f"\n{Colors.CYAN}  Quality Score:{Colors.RESET} {score_color}{Colors.BOLD}{score}/100{Colors.RESET}")
    
    # Issues by severity
    print(f"\n{Colors.CYAN}  Issues:{Colors.RESET}")
    print(f"    {Colors.RED}Errors:   {summary['errors']}{Colors.RESET}")
    print(f"    {Colors.YELLOW}Warnings: {summary['warnings']}{Colors.RESET}")
    print(f"    {Colors.CYAN}Info:     {summary['info']}{Colors.RESET}")
    
    # Issues by category
    if summary['issues_by_category']:
        print(f"\n{Colors.CYAN}  By Category:{Colors.RESET}")
        for cat, count in sorted(summary['issues_by_category'].items(), key=lambda x: -x[1]):
            print(f"    {cat}: {count}")
    
    # Status
    status = summary['status']
    if status == "passed":
        print(f"\n{Colors.BOLD}  Status: {Colors.GREEN}✓ PASSED{Colors.RESET}")
    else:
        print(f"\n{Colors.BOLD}  Status: {Colors.RED}✗ FAILED{Colors.RESET}")
    
    print(f"{'═' * 65}\n")
    
    # Show issues
    all_issues = (
        report["backend"]["issues"] +
        report["frontend"]["unit"]["issues"] +
        report["frontend"]["e2e"]["issues"]
    )
    
    if not all_issues:
        print(f"{Colors.GREEN}  No issues found! 🎉{Colors.RESET}\n")
        return
    
    # Group by severity
    errors = [i for i in all_issues if i["severity"] == "error"]
    warnings = [i for i in all_issues if i["severity"] == "warning"]
    infos = [i for i in all_issues if i["severity"] == "info"]
    
    def print_issues(issues: list, label: str, color: str) -> None:
        if not issues:
            return
        print(f"\n{color}{Colors.BOLD}  {label}:{Colors.RESET}")
        for issue in issues[:20 if not show_all else None]:  # Limit unless show_all
            line = f":{issue['line']}" if issue.get('line') else ""
            print(f"    {color}•{Colors.RESET} {issue['file']}{line}")
            print(f"      {issue['message']}")
            if issue.get('suggestion'):
                print(f"      {Colors.DIM}→ {issue['suggestion']}{Colors.RESET}")
        if len(issues) > 20 and not show_all:
            print(f"      {Colors.DIM}... and {len(issues) - 20} more (use --show-all){Colors.RESET}")
    
    print_issues(errors, "ERRORS", Colors.RED)
    print_issues(warnings, "WARNINGS", Colors.YELLOW)
    if show_all:
        print_issues(infos, "INFO", Colors.CYAN)
    elif infos:
        print(f"\n{Colors.CYAN}  INFO: {len(infos)} suggestions (use --show-all to see){Colors.RESET}")
    
    print()


# =============================================================================
# CLI
# =============================================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Test Quality Gate - Detect low-quality tests automatically",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument("--repo-root", type=Path, default=Path("."),
                        help="Repository root (default: .)")
    parser.add_argument("--report-path", type=Path,
                        default=Path("test-results/test-quality-report.json"),
                        help="JSON report output path")
    parser.add_argument("--backend-app", default="gym_app",
                        help="Django app name (default: gym_app)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Verbose output")
    parser.add_argument("--strict", action="store_true",
                        help="Fail on warnings too (not just errors)")
    parser.add_argument("--show-all", action="store_true",
                        help="Show all issues including info-level")
    parser.add_argument("--no-color", action="store_true",
                        help="Disable colored output")
    parser.add_argument("--json-only", action="store_true",
                        help="Output JSON only")
    
    # Threshold overrides
    parser.add_argument("--max-test-lines", type=int, default=50)
    parser.add_argument("--max-assertions", type=int, default=7)
    parser.add_argument("--max-patches", type=int, default=5)
    
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    
    if args.no_color or args.json_only or not sys.stdout.isatty():
        Colors.disable()
    
    repo_root = args.repo_root.resolve()
    if not repo_root.exists():
        print(f"Error: Repository not found: {repo_root}", file=sys.stderr)
        return 2
    
    # Build config with overrides
    config = Config(
        backend_app_name=args.backend_app,
        max_test_lines=args.max_test_lines,
        max_assertions_per_test=args.max_assertions,
        max_patches_per_test=args.max_patches,
    )
    
    # Build report
    try:
        builder = QualityReport(repo_root, config, args.verbose)
        report = builder.build()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 2
    
    # Write JSON
    report_path = (repo_root / args.report_path).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    
    # Output
    if args.json_only:
        print(json.dumps(report, indent=2))
    else:
        print_report(report, args.show_all)
        print(f"Report: {report_path}")
    
    # Exit code
    summary = report["summary"]
    if summary["errors"] > 0:
        return 1
    if args.strict and summary["warnings"] > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())