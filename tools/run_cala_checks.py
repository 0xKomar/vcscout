#!/usr/bin/env python3
"""Run a bounded, saved list of focused Cala checks."""

import argparse
import concurrent.futures
import json
from datetime import datetime, timezone
from pathlib import Path

from cala_http import call_json
from probe_cala import ROOT, answer_state, read_key, redact


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", type=Path)
    parser.add_argument("--timeout", type=float, default=90)
    parser.add_argument("--workers", type=int, choices=[1, 2], default=2)
    args = parser.parse_args()
    checks = json.loads(args.plan.read_text())
    if not isinstance(checks, list) or not checks or len(checks) > 12:
        parser.error("Plan must contain between 1 and 12 checks")
    for check in checks:
        if check.get("endpoint") not in ("query", "search") or not isinstance(check.get("input"), str):
            parser.error("Each check needs a query/search endpoint and an input string")
    key = read_key(ROOT / ".env")
    output = ROOT / "research" / "cala-runs" / datetime.now(timezone.utc).strftime("focused-%Y%m%dT%H%M%S%fZ")
    output.mkdir(parents=True)
    print(f"Collecting {len(checks)} focused checks in {output}", flush=True)

    def run(index, check):
        payload = {"input": check["input"], "return_entities": True}
        if check["endpoint"] == "search":
            payload["explainability"] = True
        result = call_json("knowledge/" + check["endpoint"], key, payload, args.timeout)
        result["answer_state"] = answer_state(result.get("data"))
        record = redact({**check, **result}, key)
        (output / f"{index:02d}.json").write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n")
        print(f"{check['label']}: HTTP {result['status']}, {result['elapsed_seconds']}s, "
              f"answer_state={result['answer_state']}", flush=True)
        return result["ok"] and result["answer_state"] == "data_returned"

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(run, index, check) for index, check in enumerate(checks, 1)]
        results = [future.result() for future in futures]
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
