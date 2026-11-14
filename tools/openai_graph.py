"""OpenAI helpers for focused, source-backed warm-introduction research."""

import json
import time
from urllib.parse import parse_qsl, urlencode, urlsplit

from cala_http import call_json

MODEL = "gpt-6-luna"

RANK_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["order", "skip"],
    "properties": {
        "order": {"type": "array", "items": {"type": "string"}},
        "skip": {"type": "array", "items": {"type": "string"}},
    },
}

PEOPLE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["rows"],
    "properties": {
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["person", "role", "relationship", "affiliation",
                             "start_date", "end_date", "source_url", "profile_url"],
                "properties": {
                    "person": {"type": "string"},
                    "role": {"type": ["string", "null"]},
                    "relationship": {"type": "string"},
                    "affiliation": {"type": ["string", "null"]},
                    "start_date": {"type": ["string", "null"]},
                    "end_date": {"type": ["string", "null"]},
                    "source_url": {"type": "string"},
                    "profile_url": {"type": ["string", "null"]},
                },
            },
        },
    },
}

FACTS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["rows"],
    "properties": {
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["category", "organization", "role",
                             "start_date", "end_date", "source_url"],
                "properties": {
                    "category": {"type": "string"},
                    "organization": {"type": "string"},
                    "role": {"type": ["string", "null"]},
                    "start_date": {"type": ["string", "null"]},
                    "end_date": {"type": ["string", "null"]},
                    "source_url": {"type": "string"},
                },
            },
        },
    },
}

CONNECTIONS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["rows"],
    "properties": {
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["connected_person", "connected_person_role",
                             "connected_person_organization", "organization",
                             "organization_type", "relationship", "context",
                             "date", "source_url", "profile_url"],
                "properties": {
                    "connected_person": {"type": "string"},
                    "connected_person_role": {"type": ["string", "null"]},
                    "connected_person_organization": {"type": ["string", "null"]},
                    "organization": {"type": ["string", "null"]},
                    "organization_type": {"type": "string"},
                    "relationship": {"type": "string"},
                    "context": {"type": ["string", "null"]},
                    "date": {"type": ["string", "null"]},
                    "source_url": {"type": "string"},
                    "profile_url": {"type": ["string", "null"]},
                },
            },
        },
    },
}


def _text_rows(data, key):
    if not isinstance(data, dict) or data.get("status") != "completed":
        return None
    text = ""
    for item in data.get("output") or []:
        if item.get("type") == "message":
            text += "".join(part.get("text") or "" for part in item.get("content") or []
                            if part.get("type") == "output_text")
    try:
        answer = json.loads(text)
    except json.JSONDecodeError:
        return None
    return answer.get(key) if isinstance(answer, dict) else None


def _url_key(url):
    if not isinstance(url, str):
        return ''
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or '').casefold().removeprefix('www.')
        if parsed.scheme not in ('http', 'https') or not host:
            return ''
        query = urlencode(sorted((key, value) for key, value in parse_qsl(parsed.query)
                                 if not key.casefold().startswith('utm_')
                                 and key.casefold() not in ('fbclid', 'gclid')))
        return f'{host}{parsed.path.rstrip("/")}' + (f'?{query}' if query else '')
    except ValueError:
        return ''


def _cited_urls(data):
    urls = set()
    for item in data.get('output', []) if isinstance(data, dict) else []:
        if not isinstance(item, dict):
            continue
        if item.get('type') == 'web_search_call':
            action = item.get('action')
            for source in action.get('sources', []) if isinstance(action, dict) else []:
                if isinstance(source, dict):
                    urls.add(_url_key(source.get('url')))
        if item.get('type') == 'message':
            for part in item.get('content') or []:
                if not isinstance(part, dict):
                    continue
                for annotation in part.get('annotations') or []:
                    if isinstance(annotation, dict) and annotation.get('type') == 'url_citation':
                        citation = annotation.get('url_citation') or annotation
                        if isinstance(citation, dict):
                            urls.add(_url_key(citation.get('url')))
    urls.discard('')
    return urls


def cited_rows(data, rows):
    """Accept only URLs actually returned by web search, not URLs invented in JSON."""
    urls = _cited_urls(data)
    accepted = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict) or _url_key(row.get('source_url')) not in urls:
            continue
        row = dict(row)
        if row.get('profile_url') and _url_key(row['profile_url']) not in urls:
            row['profile_url'] = None
        accepted.append(row)
    return accepted


def _call(key, payload, timeout):
    for attempt in range(2):
        result = call_json("responses", key, payload, timeout,
                           base="https://api.openai.com/v1/", auth="Authorization: Bearer ")
        if result.get("status") == 200:
            return result.get("data")
        if attempt or (result.get("status") is not None and result.get("status") != 429
                       and result.get("status") < 500):
            return None
        time.sleep(1)
    return None


def rank_candidates(me_name, me_context, targets, candidates, key, timeout=30):
    """Order candidate node ids best-first for finding bridge people, or None on failure."""
    target_lines = "\n".join(
        f'- {t["name"]} ({t["org"]})' for t in targets)
    candidate_lines = "\n".join(
        f'- {c["id"]} | {c["kind"]} | {c["label"]}'
        + (f' — {c["sublabel"]}' if c.get("sublabel") else '')
        + (f' | linked to: {", ".join(c["links"][:6])}' if c.get("links") else '')
        for c in candidates)
    prompt = (
        "You are helping find warm-introduction paths in a professional network graph.\n"
        f"The user is {me_name} ({me_context or 'no extra context'}). "
        "They want warm introduction paths to these people:\n"
        f"{target_lines}\n\n"
        "Expanding a node means searching public sources for people connected to it. "
        "Rank the candidate nodes by how likely their expansion reveals a bridge person — "
        "someone affiliated with BOTH the user's side and a target's side (for example a person "
        "who studied at the user's school and works at a target's company), or an organization "
        "whose members plausibly span both sides. Deprioritize huge generic organizations and "
        "nodes unlikely to surface anyone new.\n"
        "Return candidate ids best-first in \"order\" (at most 12), and ids not worth expanding "
        "in \"skip\".\n\nCandidates:\n"
        f"{candidate_lines}")
    payload = {
        "model": MODEL,
        "reasoning": {"effort": "low"},
        "max_output_tokens": 1500,
        "text": {"format": {"type": "json_schema", "name": "rank", "strict": True,
                            "schema": RANK_SCHEMA}},
        "input": prompt,
    }
    data = _call(key, payload, timeout)
    order = _text_rows(data, "order")
    if not isinstance(order, list):
        return None
    valid = {c["id"] for c in candidates}
    return [item for item in order if isinstance(item, str) and item in valid]


def search_people(subject, kind, focus, key, timeout=75, counterpart=None, focus_people=(), include_adjacent=False):
    """Return cited rows for the selected identity and opposite side of the search."""
    counterpart = counterpart or {}
    other_name = counterpart.get('name', '')
    other_context = counterpart.get('context', '')
    focus_clause = (
        f" The other endpoint is {other_name} ({other_context or 'no extra identity details'})."
        if other_name else ""
    )
    if focus:
        focus_clause += " Look for evidence connecting the subject to: " + ", ".join(focus) + "."
    if focus_people:
        focus_clause += " Prioritize these already-known people: " + ", ".join(focus_people) + "."
    identity_rule = (
        " Disambiguate the exact person using their provided organizations and profile. "
        "Names alone do not establish identity. If the identity, role, or affiliation is uncertain, "
        "omit the row. Never claim someone works for an organization merely because they invested "
        "in it, attended an event, or know someone there."
    )
    if kind == "background":
        prompt = (
            "Search the public web — LinkedIn profiles, company pages, press. List up to 10 "
            f"professional background facts of {subject}: jobs at companies (including companies "
            "they founded), education at schools and universities, board seats, angel investments "
            "advisory roles, and accelerator or program participations."
            + focus_clause +
            " One JSON object per fact in \"rows\": category (role for a job, founder for a company "
            "they founded, education, board, advisor, angel, program), organization (the employer, company, "
            "school or program), role, start_date, end_date, source_url. Only rows where a real "
            "public URL supports the specific fact; never guess." + identity_rule)
        schema, key_name = FACTS_SCHEMA, "rows"
    elif kind == "org":
        prompt = (
            "Search the public web, including LinkedIn and company pages, for a short list of "
            f"people documented at {subject} who could bridge to the other endpoint."
            + focus_clause +
            " One JSON object per person in \"rows\": person, role, relationship (founder, executive, "
            "employee, investor, board, advisor, organizer, jury, mentor, speaker, participant, "
            "alumni, other), affiliation (their other organization or null), start_date, end_date, "
            "source_url and profile_url (their LinkedIn profile if directly found, otherwise null). "
            "Do not fill the list with unrelated famous alumni or staff; return no rows if no "
            "relevant connection is supported by a source." + identity_rule)
        schema, key_name = PEOPLE_SCHEMA, "rows"
    else:
        extra_hops = (
            " If no direct bridge is documented, include at most two directly documented colleagues, "
            "co-founders, classmates, teammates, co-authors or people who appeared together for further "
            "investigation. A co-appearance does not prove a personal acquaintance."
            if include_adjacent else ""
        )
        prompt = (
            "Search the public web, including LinkedIn and company pages, for people publicly "
            f"documented as professionally connected to {subject} who could bridge to the other endpoint."
            + focus_clause + extra_hops +
            " One JSON object per connection in \"rows\": connected_person, connected_person_role, "
            "connected_person_organization, organization (where the connection is documented), "
            "organization_type (company, fund, school, event, media, other), relationship "
            "(co-founder, colleague, investor, portfolio-founder, board, classmate, teammate, "
            "co-author, co-appearance, advisor, other), context (one sentence), date, source_url, "
            "and profile_url (their LinkedIn profile if directly found, otherwise null). "
            "A source must name both people and support their relationship. Do not fill the list "
            "with unrelated people; return no rows if no relevant bridge is supported." + identity_rule)
        schema, key_name = CONNECTIONS_SCHEMA, "rows"
    payload = {
        "model": MODEL,
        "reasoning": {"effort": "low"},
        "tools": [{"type": "web_search", "search_context_size": "low"}],
        "tool_choice": "required",
        "include": ["web_search_call.action.sources"],
        "max_output_tokens": 4000,
        "text": {"format": {"type": "json_schema", "name": "people", "strict": True,
                            "schema": schema}},
        "input": prompt,
    }
    data = _call(key, payload, timeout)
    rows = _text_rows(data, key_name)
    return cited_rows(data, rows) if isinstance(rows, list) else None
