"""Bounded JSON API requests through system curl, without keys in arguments. Defaults to Cala."""

import json
import subprocess
import tempfile
import time


def call_json(path, key, payload=None, timeout=90, base="https://api.cala.ai/v1/", auth="X-API-KEY: "):
    started = time.monotonic()
    if any(character in key for character in "\r\n"):
        raise ValueError("Invalid API key format")
    with tempfile.NamedTemporaryFile(mode="w", prefix="cala-headers-", encoding="utf-8") as headers:
        headers.write(f"{auth}{key}\nContent-Type: application/json\n")
        headers.flush()
        command = [
            "curl", "-q", "--silent", "--show-error", "--connect-timeout", "10",
            "--max-time", str(timeout), "--header", "@" + headers.name,
            "--request", "POST" if payload is not None else "GET",
            "--write-out", "\n%{http_code}",
        ]
        if payload is not None:
            command.extend(["--data-binary", "@-"])
        command.append(base + path)
        try:
            response = subprocess.run(command, input=json.dumps(payload) if payload is not None else None,
                                      text=True, capture_output=True, timeout=timeout + 5)
        except (OSError, subprocess.TimeoutExpired) as error:
            return {"ok": False, "status": None, "error": type(error).__name__,
                    "elapsed_seconds": round(time.monotonic() - started, 2)}
    elapsed = round(time.monotonic() - started, 2)
    body, _, status_text = response.stdout.rpartition("\n")
    status = int(status_text) if status_text.isdigit() and status_text != "000" else None
    if response.returncode:
        return {"ok": False, "status": status, "error": response.stderr.strip().replace(key, "[REDACTED]"),
                "elapsed_seconds": elapsed}
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return {"ok": False, "status": status, "error": "Non-JSON response", "body": body[:1000],
                "elapsed_seconds": elapsed}
    api_error = isinstance(data, dict) and (data.get("response_type") == "ERROR" or "error" in data)
    return {"ok": status is not None and 200 <= status < 300 and not api_error,
            "status": status, "data": data, "elapsed_seconds": elapsed}
