#!/usr/bin/env python3
"""Save the known partners' dossiers for Warm intros. Makes live Cala queries
(four per partner); run manually, never from automated tests."""

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import PARTNERS, SAVED_DOSSIERS, dossier_facts

FUND_NAMES = {'byfounders': 'byFounders', 'point nine': 'Point Nine', 'plural': 'Plural',
              'vertex ventures us': 'Vertex Ventures US', 'spark capital': 'Spark Capital'}
# Rows unsupported by their source, duplicates of other rows, or without a named organization.
EXCLUDED = {
    ('khaled helioui', 'role', 'plural france', 'executive'),
    ('magnus hambleton', 'role', 'startup accelerator & co-working space (perth, australia)', 'founder'),
    ('magnus hambleton', 'board', 'qa tech ab / fluencify', 'board member'),
    ('magnus hambleton', 'coinvestor', 'hummingbird ventures', 'pre-seed'),
    ('yasmin razavi', 'board', 'anthropic, pbc', 'board member'),
}


def main():
    partners, seen = [], set()
    for (_, fund), people in PARTNERS.items():
        for person in people:
            key = (person['name'], fund)
            if key not in seen:
                seen.add(key)
                partners.append((person['name'], FUND_NAMES.get(fund, fund)))
    dossiers, failures = [], []
    for name, fund in partners:
        facts, cached, failed = dossier_facts(name, fund)
        counts = {}
        for fact in facts:
            counts[fact['kind']] = counts.get(fact['kind'], 0) + 1
        summary = ', '.join(f'{kind}: {count}' for kind, count in counts.items()) or 'no facts'
        print(f'{name} ({fund}): {summary}; cached={cached}; failed={failed or "none"}', flush=True)
        if failed:
            failures.append((name, failed))
        dossiers.append({'name': name, 'fund': fund,
                         'facts': [f for f in facts if (name.casefold(), f['kind'], f['organization'].casefold(),
                                                      f['role'].casefold()) not in EXCLUDED]})
    if failures:
        print('Failed parts: ' + '; '.join(f'{name} {failed}' for name, failed in failures))
        return 1
    SAVED_DOSSIERS.write_text(json.dumps({'saved_at': date.today().isoformat(), 'dossiers': dossiers},
                                         ensure_ascii=False, indent=1) + '\n')
    print(f'Wrote {SAVED_DOSSIERS} ({len(dossiers)} dossiers)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
