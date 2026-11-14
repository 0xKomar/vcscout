#!/usr/bin/env python3
"""Collect Cala responses for manual verification of investor paths.

Uses Python's standard library and system curl. No API calls are made with --dry-run.
The default sample is three companies, two API calls per company.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from cala_http import call_json


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_COMPANIES = ["Qdrant", "Attio", "Metaview"]


def read_key(env_file, name="CALA_API_KEY"):
    key = os.environ.get(name, "").strip()
    if key:
        return key
    if env_file.is_file():
        for line in env_file.read_text().splitlines():
            variable, separator, value = line.removeprefix("export ").partition("=")
            if separator and variable.strip() == name:
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                    value = value[1:-1]
                if value:
                    return value
    raise ValueError(f"Set {name} in the environment or in {env_file}")


def request_plan(companies):
    for company in companies:
        yield {
            "company": company,
            "endpoint": "query",
            "input": (
                f"List the publicly announced equity funding rounds of {company}, "
                "from its earliest round through Series B, in chronological order. "
                "Use one row per round with fields: company, round_type, "
                "announcement_date, amount, currency, lead_investors, investors, "
                "source_urls. Use full investor names. Include only investors "
                "explicitly reported for that specific round. Do not mix total "
                "funding with a round amount. Preserve the precision of dates "
                "reported by sources; do not invent a day or month. Use null for "
                "unknown facts. Prefer direct company or investor announcements."
            ),
        }
        yield {
            "company": company,
            "endpoint": "search",
            "input": (
                f"For {company}, verify the earlier funding rounds through Series B "
                "and name the investors in each round, with announcement dates "
                "and direct public source URLs for each round. Then identify "
                "any named investment professionals explicitly linked to those "
                "investments by public evidence. For every person, state the "
                "fund and the exact documented relationship: led the investment, "
                "board member, authored an investment thesis, or quoted in the "
                "announcement. Authorship or a quote alone does not prove that "
                "someone led a deal. Distinguish their role at the time from "
                "their current role; give a source for any claim of current "
                "employment. Explicitly say unknown where evidence is missing. "
                "Separate same-round co-investment from a new investor entering "
                "a later round. Do not infer personal introductions, causality, "
                "private relationships, or email addresses."
            ),
        }


def redact(value, secret):
    if isinstance(value, str):
        return value.replace(secret, "[REDACTED]")
    if isinstance(value, list):
        return [redact(item, secret) for item in value]
    if isinstance(value, dict):
        return {redact(key, secret): redact(item, secret) for key, item in value.items()}
    return value


def answer_state(data):
    """Separate transport success from Cala's known HTTP-200 fallback."""
    if not isinstance(data, dict):
        return "unexpected_shape"
    candidates = [data.get("content"), data.get("error"), data.get("message")]
    rows = data.get("results")
    if isinstance(rows, list):
        candidates.extend(row.get("error") for row in rows if isinstance(row, dict))
    if any(isinstance(value, str) and value.strip().lower().startswith(
            "this question is too complex to answer fully") for value in candidates):
        return "fallback"
    if data.get("response_type") == "ERROR" or "error" in data:
        return "api_error"
    if isinstance(rows, list):
        return "data_returned" if rows else "empty"
    if isinstance(data.get("content"), str):
        return "data_returned" if data["content"].strip() else "empty"
    return "unexpected_shape"


def call_api(step, key, timeout):
    payload = {"input": step["input"], "return_entities": True}
    if step["endpoint"] == "search":
        payload["explainability"] = True
    result = call_json("knowledge/" + step["endpoint"], key, payload, timeout)
    result["answer_state"] = answer_state(result.get("data"))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--companies", nargs="+", default=DEFAULT_COMPANIES)
    parser.add_argument("--endpoints", nargs="+", choices=["query", "search"], default=["query", "search"])
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env")
    parser.add_argument("--output", type=Path, default=ROOT / "research" / "cala-runs")
    parser.add_argument("--timeout", type=float, default=90)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    plan = [step for step in request_plan(args.companies) if step["endpoint"] in args.endpoints]
    if args.dry_run:
        print(json.dumps({"api_calls": len(plan), "requests": plan}, indent=2))
        return 0
    try:
        key = read_key(args.env_file)
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 2
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    output = args.output / stamp
    output.mkdir(parents=True, exist_ok=False)
    records = []
    print(f"Collecting {len(plan)} API responses in {output}", flush=True)
    for index, step in enumerate(plan, start=1):
        result = call_api(step, key, args.timeout)
        records.append(redact({**step, **result}, key))
        (output / "responses.json").write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")
        label = result["answer_state"] if result["ok"] else "FAILED"
        print(f"{index}/{len(plan)} {step['company']} {step['endpoint']}: "
              f"{label}, HTTP {result['status']}, {result['elapsed_seconds']}s", flush=True)
        # Stop on authentication, billing, rate-limit, or network errors.
        if result["status"] in (None, 401, 402, 403, 429):
            break
    print("Responses collected; data accuracy and coverage still require manual verification.")
    return 0 if len(records) == len(plan) and all(
        r["ok"] and r["answer_state"] == "data_returned" for r in records) else 1


if __name__ == "__main__":
    sys.exit(main())
