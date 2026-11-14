#!/usr/bin/env python3
"""Inspect available Cala graph relationships for a small named sample."""

import argparse
import json
import urllib.parse
import uuid
from datetime import datetime, timezone

from cala_http import call_json
from probe_cala import ROOT, read_key, redact


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--names", nargs="+", default=["Qdrant", "Attio", "Metaview"])
    parser.add_argument("--ids", nargs="+", type=lambda value: str(uuid.UUID(value)))
    parser.add_argument("--timeout", type=float, default=30)
    args = parser.parse_args()
    key = read_key(ROOT / ".env")
    output = ROOT / "research" / "cala-runs" / datetime.now(timezone.utc).strftime("entities-%Y%m%dT%H%M%S%fZ")
    output.mkdir(parents=True)
    records = []

    def request(path, body=None):
        result = call_json(path, key, body, args.timeout)
        record = redact({"path": path, "body": body, **result}, key)
        records.append(record)
        (output / "responses.json").write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")
        print(f"{'POST' if body is not None else 'GET'} {path}: HTTP {record['status']}, "
              f"{record['elapsed_seconds']}s", flush=True)
        return record

    print(f"Saving graph inspections in {output}", flush=True)
    selected_ids = list(args.ids or [])
    for name in ([] if args.ids else args.names):
        result = request("entities?" + urllib.parse.urlencode({"name": name, "limit": 5}))
        if not result["ok"]:
            return 1
        entities = result["data"].get("entities") or []
        companies = [e for e in entities if e.get("entity_type") == "Company"]
        matches = [e for e in companies if e.get("name", "").casefold() == name.casefold()]
        if not matches and len(companies) == 1:
            matches = companies
        if len(matches) != 1:
            print(f"No unambiguous company match for {name}; inspect saved candidates.", flush=True)
            continue
        selected_ids.append(matches[0]["id"])
    for entity_id in selected_ids:
        schema = request(f"entities/{entity_id}/introspection")
        if not schema["ok"]:
            return 1
        properties = schema["data"].get("properties") or []
        relationships = schema["data"].get("relationships") or {}
        body = {"properties": properties,
                "relationships": {direction: {relation: {"limit": 50, "offset": 0}
                                                for relation in relations}
                                  for direction, relations in relationships.items()
                                  if direction in ("incoming", "outgoing") and isinstance(relations, list)}}
        if not request(f"entities/{entity_id}", body)["ok"]:
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
