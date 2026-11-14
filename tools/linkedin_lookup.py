"""LinkedIn profile lookup through OpenAI web search, restricted to linkedin.com."""

import html
import json
import re
import subprocess
import time
from urllib.parse import urlsplit

from cala_http import call_json

MODEL = "gpt-6-luna"
PROMPT = ("Find the personal LinkedIn profile of {name}, {role} {organization}. "
          "Return its linkedin.com/in/ URL only if a search result shows that this profile belongs to this person "
          "at this {place}, and quote that result's title in evidence. If you are not sure, return null for both. "
          "Never guess or construct a URL.")
ROLES = {"fund": ("an investor at the venture capital fund", "fund"), "startup": ("a founder of the startup", "company")}
PREVIEW_AGENT = "VCScout/0.1 (link preview)"
OG_IMAGE = (re.compile(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"'),
            re.compile(r'<meta[^>]+content="([^"]+)"[^>]+property="og:image"'))
SCHEMA = {"type": "object", "additionalProperties": False, "required": ["linkedin_url", "evidence"],
          "properties": {"linkedin_url": {"type": ["string", "null"]}, "evidence": {"type": ["string", "null"]}}}


def profile_url(url):
    """Canonical https://www.linkedin.com/in/<slug> for a personal profile URL, else None."""
    if not isinstance(url, str):
        return None
    try:
        parts = urlsplit(url.strip())
    except ValueError:
        return None
    host = (parts.hostname or "").lower()
    if parts.scheme not in ("http", "https") or not (host == "linkedin.com" or host.endswith(".linkedin.com")):
        return None
    segments = [segment for segment in parts.path.split("/") if segment]
    if len(segments) < 2 or segments[0] != "in" or not re.fullmatch(r"[\w%-]{2,100}", segments[1]):
        return None
    return "https://www.linkedin.com/in/" + segments[1].lower()


def parse_profile(data):
    """Profile from a Responses API result. A URL counts only if the search actually returned it."""
    if not isinstance(data, dict) or data.get("status") != "completed":
        return None
    sources, text = set(), ""
    for item in data.get("output") or []:
        if item.get("type") == "web_search_call":
            sources.update(profile_url(source.get("url")) for source in (item.get("action") or {}).get("sources") or [])
        elif item.get("type") == "message":
            text += "".join(part.get("text") or "" for part in item.get("content") or [] if part.get("type") == "output_text")
    try:
        answer = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(answer, dict):
        return None
    url = profile_url(answer.get("linkedin_url"))
    if not url or url not in sources:
        return {"url": None, "evidence": None}
    return {"url": url, "evidence": str(answer.get("evidence") or "")[:200] or None}


def find_profile(name, organization, kind, key, timeout=60):
    """Return {"url", "evidence"} (url is None when nothing reliable was found), or None when the lookup failed.

    kind is "fund" for an investor at that fund or "startup" for a founder of that company.
    """
    role, place = ROLES[kind]
    payload = {
        "model": MODEL,
        "reasoning": {"effort": "low"},
        "tools": [{"type": "web_search", "search_context_size": "low", "filters": {"allowed_domains": ["linkedin.com"]}}],
        "tool_choice": "required",
        "include": ["web_search_call.action.sources"],
        "max_output_tokens": 2000,
        "text": {"format": {"type": "json_schema", "name": "linkedin_profile", "strict": True, "schema": SCHEMA}},
        "input": PROMPT.format(name=name, role=role, organization=organization, place=place),
    }
    for attempt in range(2):
        result = call_json("responses", key, payload, timeout, base="https://api.openai.com/v1/", auth="Authorization: Bearer ")
        status = result.get("status")
        if status == 200:
            return parse_profile(result.get("data"))
        # Retry once after a connection failure, rate limit or server error.
        if attempt or (status is not None and status != 429 and status < 500):
            return None
        time.sleep(1)


def photo_url(url):
    """The URL if it is a LinkedIn-hosted profile photo, else None (placeholders, other hosts)."""
    try:
        parts = urlsplit(url)
    except ValueError:
        return None
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or not host.endswith(".licdn.com") or "profile-displayphoto" not in parts.path:
        return None
    if len(url) > 600 or any(character.isspace() or character in "\"'<>" for character in url):
        return None
    return url


def fetch_photo(profile, timeout=15):
    """Read the photo from the public profile page's link-preview tags.

    Returns (fetched, photo): fetched is False when the page could not be read, so the caller can retry later.
    """
    command = ["curl", "-q", "--silent", "--location", "--max-redirs", "3", "--proto", "=https", "--proto-redir", "=https",
               "--max-time", str(timeout), "--max-filesize", "5000000", "--user-agent", PREVIEW_AGENT,
               "--write-out", "\n%{http_code}", profile]
    try:
        response = subprocess.run(command, capture_output=True, encoding="utf-8", errors="replace", timeout=timeout + 5)
    except (OSError, subprocess.TimeoutExpired):
        return False, None
    body, _, status = response.stdout.rpartition("\n")
    if response.returncode or status != "200":
        return False, None
    for pattern in OG_IMAGE:
        match = pattern.search(body)
        if match:
            return True, photo_url(html.unescape(match.group(1)))
    return True, None
