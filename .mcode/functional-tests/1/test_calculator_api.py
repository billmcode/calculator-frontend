"""
Functional tests for `src/api/calculatorApi.ts`, the data-access layer that
replaced Angular's `HttpClient`/RxJS `CalculatorService` in this milestone's
React rewrite.

There is no real `/api` backend in this sandbox (it's an out-of-scope
external service). Rather than re-testing calculatorApi.ts with `fetch`
mocked (already done exhaustively by the implementer's Vitest unit suite),
these tests exercise the *actual, unmodified* module end-to-end over real
HTTP:

  pytest (subprocess) -> node --experimental-strip-types node_harness.mjs
    -> imports src/api/calculatorApi.ts directly (no transpilation/copy)
    -> real fetch() to the live Vite dev server (http://localhost:$PORT)
    -> Vite's own `server.proxy` config (vite.config.ts) rewrites /api -> ''
    -> real HTTP to mock_backend.py (a minimal stand-in for the documented
       `/api` contract: POST/GET/DELETE /calculations, operation codes
       add/sub/mul/div, error bodies `{"detail": "..."}`)

This verifies the real request shape calculatorApi.ts sends, how it parses
real success/error HTTP responses (including the ApiError detail-extraction
and 'Calculation failed' fallback), and that the Vite proxy wiring from this
milestone actually works - not just that a mocked fetch was called with the
right arguments.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time

import pytest
import requests

sys.path.insert(0, os.path.dirname(__file__))
import mock_backend  # noqa: E402

REPO_ROOT = os.path.join(os.environ.get("WORKSPACE_DIR", "/l2l/workspace"), "calculator-frontend")
HARNESS = os.path.join(os.path.dirname(__file__), "node_harness.mjs")
VITE_PORT = os.environ.get("PORT", "5173")
VITE_BASE = f"http://localhost:{VITE_PORT}"
BACKEND_PORT = 8000
BACKEND_BASE = f"http://localhost:{BACKEND_PORT}"


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------


@pytest.fixture(scope="session", autouse=True)
def mock_api_backend():
    """Start the mock `/api` backend once for the whole test session."""
    server = mock_backend.MockBackend(BACKEND_PORT)
    server.start()
    # Give the listener a moment to bind.
    for _ in range(20):
        try:
            requests.post(f"{BACKEND_BASE}/__reset__", timeout=1)
            break
        except requests.exceptions.ConnectionError:
            time.sleep(0.1)
    yield server
    server.stop()


@pytest.fixture(autouse=True)
def reset_backend_state():
    """Reset in-memory history before every test for isolation."""
    requests.post(f"{BACKEND_BASE}/__reset__", timeout=5)
    yield


@pytest.fixture(scope="session", autouse=True)
def frontend_health_check():
    """Confirm the real Vite dev server (built by the `run` lifecycle script)
    is up before running any test — every test below routes through its
    live `/api` proxy."""
    resp = requests.get(f"{VITE_BASE}/", timeout=10)
    assert resp.status_code == 200
    assert 'id="root"' in resp.text


# --------------------------------------------------------------------------
# Helper
# --------------------------------------------------------------------------


def run_harness(command: str, *args: str) -> tuple[dict, int, float]:
    """Invoke the Node harness, which imports and runs the real
    calculatorApi.ts module against the live Vite dev server + mock backend.

    Returns (parsed_stdout_json, exit_code, duration_ms).
    """
    start = time.monotonic()
    result = subprocess.run(
        ["node", "--experimental-strip-types", HARNESS, command, *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=30,
        env={**os.environ, "FT_VITE_BASE": VITE_BASE},
    )
    duration_ms = (time.monotonic() - start) * 1000
    assert result.stdout, f"harness produced no stdout; stderr={result.stderr}"
    payload = json.loads(result.stdout)
    return payload, result.returncode, duration_ms


WRITE_RESULTS = "/l2l/.claude/skills/sandbox-app-runner/write_test_results.py"


def record(**kwargs) -> None:
    cmd = [
        sys.executable,
        WRITE_RESULTS,
        "--repo-type",
        "target",
        "--repo-name",
        "calculator-frontend",
        "--test-run-index",
        "1",
    ]
    for key, value in kwargs.items():
        if value is None:
            continue
        flag = "--" + key.replace("_", "-")
        if isinstance(value, bool):
            cmd.append(flag if value else flag.replace("--", "--no-", 1))
        else:
            cmd.extend([flag, str(value)])
    subprocess.run(cmd, check=True, timeout=15)


# --------------------------------------------------------------------------
# Arithmetic operations (add / subtract / multiply / divide)
# --------------------------------------------------------------------------


class TestArithmeticOperations:
    """POST /api/calculations via add/subtract/multiply/divide — real HTTP
    round trip through the Vite proxy to the mock backend."""

    @pytest.mark.parametrize(
        "command,a,b,op_code,expected",
        [
            ("add", "4", "2", "add", 6),
            ("subtract", "10", "3", "sub", 7),
            ("multiply", "6", "7", "mul", 42),
            ("divide", "20", "4", "div", 5),
        ],
    )
    def test_happy_path(self, command, a, b, op_code, expected):
        payload, exit_code, duration = run_harness(command, a, b)
        request_body = json.dumps({"operation": op_code, "a": float(a), "b": float(b)})

        assert exit_code == 0
        assert payload["ok"] is True
        assert payload["result"] == {"result": expected}
        assert payload["status"] == 201

        record(
            name=f"test_{command}_happy_path",
            category="HAPPY_PATH",
            description=f"{command}({a},{b}) resolves {{result}} via real POST /api/calculations through the Vite proxy",
            endpoint="/api/calculations",
            method="POST",
            expected_status=201,
            actual_status=payload["status"],
            request_body=request_body,
            actual_output=json.dumps(payload),
            duration_ms=duration,
        )

    def test_divide_by_zero_returns_backend_detail_as_error_message(self):
        payload, exit_code, duration = run_harness("divide", "10", "0")

        assert exit_code == 1
        assert payload["ok"] is False
        assert payload["errorName"] == "ApiError"
        assert payload["status"] == 400
        assert payload["detail"] == "Division by zero is not allowed"
        assert payload["message"] == "Division by zero is not allowed"

        record(
            name="test_divide_by_zero_error_path",
            category="INVALID_INPUT",
            description="divide(10,0) surfaces the backend's real `detail` as ApiError.message over real HTTP",
            endpoint="/api/calculations",
            method="POST",
            expected_status=400,
            actual_status=payload["status"],
            request_body=json.dumps({"operation": "div", "a": 10.0, "b": 0.0}),
            actual_output=json.dumps(payload),
            duration_ms=duration,
        )

    def test_boundary_large_and_decimal_values(self):
        payload, exit_code, duration = run_harness("multiply", "123456789.5", "2")

        assert exit_code == 0
        assert payload["ok"] is True
        assert payload["result"]["result"] == pytest.approx(246913579.0)
        assert payload["status"] == 201

        record(
            name="test_multiply_boundary_large_decimal",
            category="BOUNDARY",
            description="multiply handles large decimal operands correctly over real HTTP",
            endpoint="/api/calculations",
            method="POST",
            expected_status=201,
            actual_status=payload["status"],
            request_body=json.dumps({"operation": "mul", "a": 123456789.5, "b": 2.0}),
            actual_output=json.dumps(payload),
            duration_ms=duration,
        )

    def test_invalid_type_operand_rejected_with_400(self):
        # Number("not-a-number") -> NaN -> JSON.stringify(NaN) == null,
        # so the real backend receives a non-numeric `a` field, exactly as
        # it would from any other invalid-type caller.
        payload, exit_code, duration = run_harness("add", "not-a-number", "3")

        assert exit_code == 1
        assert payload["ok"] is False
        assert payload["status"] == 400
        assert payload["detail"] == "Fields 'a' and 'b' must be numbers"

        record(
            name="test_add_invalid_type_operand",
            category="INVALID_TYPE",
            description="add() with a non-numeric operand is rejected by the backend with 400 and surfaced as ApiError",
            endpoint="/api/calculations",
            method="POST",
            expected_status=400,
            actual_status=payload["status"],
            request_body=json.dumps({"operation": "add", "a": None, "b": 3.0}),
            actual_output=json.dumps(payload),
            duration_ms=duration,
        )


# --------------------------------------------------------------------------
# getHistory()
# --------------------------------------------------------------------------


class TestGetHistory:
    """GET /api/calculations"""

    def test_history_empty_when_no_calculations(self):
        payload, exit_code, duration = run_harness("getHistory")

        assert exit_code == 0
        assert payload["ok"] is True
        assert payload["result"] == []
        assert payload["status"] == 200

        record(
            name="test_get_history_empty",
            category="HAPPY_PATH",
            description="getHistory() returns an empty array with no prior calculations, over real HTTP",
            endpoint="/api/calculations",
            method="GET",
            expected_status=200,
            actual_status=payload["status"],
            actual_output=json.dumps(payload),
            duration_ms=duration,
        )

    def test_history_reflects_full_calculation_records_after_create(self):
        add_payload, add_exit, _ = run_harness("add", "5", "6")
        assert add_exit == 0

        hist_payload, hist_exit, duration = run_harness("getHistory")
        assert hist_exit == 0
        assert hist_payload["status"] == 200
        records = hist_payload["result"]
        assert len(records) == 1
        record_fields = set(records[0].keys())
        assert record_fields == {"id", "operation", "a", "b", "result", "created_at"}
        assert records[0]["operation"] == "add"
        assert records[0]["a"] == 5
        assert records[0]["b"] == 6
        assert records[0]["result"] == 11

        record(
            name="test_get_history_full_record_shape",
            category="SETUP",
            description="getHistory() resolves the full CalculationResponse[] (not just {result}) after a real create",
            endpoint="/api/calculations",
            method="GET",
            expected_status=200,
            actual_status=hist_payload["status"],
            actual_output=json.dumps(hist_payload),
            duration_ms=duration,
        )


# --------------------------------------------------------------------------
# deleteCalculation()
# --------------------------------------------------------------------------


class TestDeleteCalculation:
    """DELETE /api/calculations/:id"""

    def test_delete_existing_calculation_succeeds_and_is_removed_from_history(self):
        add_payload, add_exit, _ = run_harness("add", "1", "1")
        assert add_exit == 0

        hist_before, _, _ = run_harness("getHistory")
        calc_id = hist_before["result"][0]["id"]

        del_payload, del_exit, duration = run_harness("deleteCalculation", str(calc_id))
        assert del_exit == 0
        assert del_payload["ok"] is True
        assert del_payload["status"] == 204

        hist_after, _, _ = run_harness("getHistory")
        assert hist_after["result"] == []

        record(
            name="test_delete_calculation_happy_path",
            category="HAPPY_PATH",
            description="deleteCalculation(id) removes the record via real DELETE /api/calculations/:id, verified by refetch",
            endpoint=f"/api/calculations/{calc_id}",
            method="DELETE",
            expected_status=204,
            actual_status=del_payload["status"],
            actual_output=json.dumps(del_payload),
            duration_ms=duration,
        )

    def test_delete_nonexistent_calculation_returns_404(self):
        payload, exit_code, duration = run_harness("deleteCalculation", "999888777")

        assert exit_code == 1
        assert payload["ok"] is False
        assert payload["status"] == 404
        assert payload["detail"] == "Calculation 999888777 not found"

        record(
            name="test_delete_nonexistent_calculation",
            category="NOT_FOUND",
            description="deleteCalculation() on an id that doesn't exist surfaces the backend's 404 detail as ApiError",
            endpoint="/api/calculations/999888777",
            method="DELETE",
            expected_status=404,
            actual_status=payload["status"],
            actual_output=json.dumps(payload),
            duration_ms=duration,
        )


# --------------------------------------------------------------------------
# ApiError fallback behavior (real non-JSON / detail-less error responses)
# --------------------------------------------------------------------------


class TestApiErrorFallback:
    """Confirms ApiError's fallback-to-'Calculation failed' logic against
    *real* HTTP responses that aren't JSON, or are JSON without a `detail`
    field — not just a mocked Response object."""

    def test_non_json_error_body_falls_back_to_default_message(self):
        # Sentinel id 999999001 makes the mock backend return a real 500
        # with a plain-text (non-JSON) body.
        payload, exit_code, duration = run_harness("deleteCalculation", "999999001")

        assert exit_code == 1
        assert payload["ok"] is False
        assert payload["status"] == 500
        assert payload["message"] == "Calculation failed"
        assert payload.get("detail") is None

        record(
            name="test_apierror_fallback_non_json_body",
            category="INVALID_INPUT",
            description="ApiError falls back to 'Calculation failed' when the real HTTP error body isn't JSON",
            endpoint="/api/calculations/999999001",
            method="DELETE",
            expected_status=500,
            actual_status=payload["status"],
            actual_output=json.dumps(payload),
            duration_ms=duration,
        )

    def test_json_error_body_without_detail_field_falls_back_to_default_message(self):
        # Sentinel id 999999002 makes the mock backend return real JSON
        # (valid, 500) that has no `detail` field.
        payload, exit_code, duration = run_harness("deleteCalculation", "999999002")

        assert exit_code == 1
        assert payload["ok"] is False
        assert payload["status"] == 500
        assert payload["message"] == "Calculation failed"
        assert payload.get("detail") is None

        record(
            name="test_apierror_fallback_json_without_detail",
            category="INVALID_INPUT",
            description="ApiError falls back to 'Calculation failed' when the real HTTP error body is JSON but has no `detail` field",
            endpoint="/api/calculations/999999002",
            method="DELETE",
            expected_status=500,
            actual_status=payload["status"],
            actual_output=json.dumps(payload),
            duration_ms=duration,
        )


# --------------------------------------------------------------------------
# Missing required field
# --------------------------------------------------------------------------


class TestMissingRequiredField:
    def test_missing_required_field_via_raw_request(self):
        """calculatorApi.ts's public functions always supply both operands,
        so a missing-required-field request can't be produced through the
        harness; this hits the real mock backend directly (the documented
        `/api` contract) to verify the contract's 400 + detail shape that
        calculatorApi.ts's `throwApiError`/`ApiError` is built to parse."""
        resp = requests.post(f"{BACKEND_BASE}/calculations", json={"operation": "add", "a": 5}, timeout=10)

        assert resp.status_code == 400
        body = resp.json()
        assert "detail" in body and isinstance(body["detail"], str)

        record(
            name="test_missing_required_field_b",
            category="MISSING_REQUIRED",
            description="POST /calculations without required field 'b' returns 400 with a `detail` string (the shape ApiError expects)",
            endpoint="/calculations",
            method="POST",
            expected_status=400,
            actual_status=resp.status_code,
            request_body=json.dumps({"operation": "add", "a": 5}),
            actual_output=resp.text,
        )
