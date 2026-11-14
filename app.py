#!/usr/bin/env python3
"""Local VCScout preview. The Cala and OpenAI keys stay on the server."""
import json
import hashlib
import os
import re
import sys
import threading
import time
import traceback
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlencode, urlsplit

ROOT = Path(__file__).resolve().parent
DIST = ROOT / 'web' / 'dist'
sys.path.insert(0, str(ROOT / 'tools'))
from cala_http import call_json
from probe_cala import read_key, answer_state
from linkedin_lookup import fetch_photo, find_profile
from openai_graph import rank_candidates, search_people

PARTNERS = {
    ('lovable', 'byfounders'): [{'name': 'Magnus Hambleton', 'role': 'Partner', 'connection': 'Author of the Lovable investment article', 'source_url': 'https://www.byfounders.vc/insights/lovable-let-ai-help-you-make-your-minimum-lovable-product'}],
    ('attio', 'point nine'): [{'name': 'Ricardo Sequerra Amram', 'role': 'Partner', 'connection': 'Publicly linked to the investment in Attio', 'source_url': 'https://attio.com/blog/attio-raises-33-million-in-funding'}],
    ('metaview', 'plural'): [{'name': 'Khaled Helioui', 'role': 'Partner', 'connection': 'Author of the Metaview investment article', 'source_url': 'https://www.pluralplatform.com/features/why-we-invested-in-metaview'}, {'name': 'Pierre-Dimitri Gore-Coty', 'role': 'Partner', 'connection': 'Linked to Metaview in SEC filings', 'source_url': 'https://www.sec.gov/Archives/edgar/data/1894764/000189476425000002/primary_doc.xml'}],
    ('metaview', 'vertex ventures us'): [{'name': 'Jonathan Heiliger', 'role': 'Investor', 'connection': "Led Metaview's seed round", 'source_url': 'https://www.metaview.ai/resources/blog/weve-raised-a-6m-seed-to-power-people-decisions-with-truth'}],
    ('qdrant', 'spark capital'): [{'name': 'Yasmin Razavi', 'role': 'General Partner', 'connection': "Quoted in coverage of Qdrant's Series A", 'source_url': 'https://pulse2.com/qdrant-28-million-funding/'}],
}
partner_cache = {}
partner_slots = threading.BoundedSemaphore(2)

FUND_PATH_STAGES = {'seed': ('a pre-seed or seed round', 'Series A or later round'),
                    'series-a': ('a Series A round', 'Series B or later round'),
                    'series-b': ('a Series B round', 'Series C or later round')}
fund_paths_cache = {}
fund_slots = threading.BoundedSemaphore(2)

person_cache = {}
person_slots = threading.BoundedSemaphore(2)

FOUNDERS = {
    'lovable': [{'name': 'Anton Osika', 'role': 'Co-Founder & CEO', 'source_url': 'https://siliconvalleyinvestclub.com/companies/lovable/team/anton-osika'},
                {'name': 'Fabian Hedin', 'role': 'Co-Founder & CTO', 'source_url': 'https://cordmagazine.com/business/entrepreneurship/fabian-hedin-co-founder-and-cto-of-lovable-coding-without-code'}],
}
founders_cache = {}
founder_slots = threading.BoundedSemaphore(2)

LINKEDIN_CACHE = ROOT / '.cache' / 'linkedin.json'
linkedin_lock = threading.Lock()
linkedin_slots = threading.BoundedSemaphore(2)

PEOPLE_CACHE = ROOT / '.cache' / 'people.json'
ENTITIES_CACHE = ROOT / '.cache' / 'entities.json'
SAVED_DOSSIERS = ROOT / 'research' / 'saved-dossiers.json'
people_lock = threading.Lock()
entity_lock = threading.Lock()
people_memory = None
entity_memory = None
me_slots = threading.BoundedSemaphore(1)
dossier_slots = threading.BoundedSemaphore(4)
network_slots = threading.BoundedSemaphore(10)
openai_slots = threading.BoundedSemaphore(3)

PRIVATE_HOSTS = ('ratsit.se', 'mrkoll.se', 'merinfo.se', 'hitta.se', 'upplysning.se')

def valid_source(url):
    if not isinstance(url, str) or not url.startswith(('https://', 'http://')) or any(c.isspace() for c in url):
        return False
    host = urlsplit(url).hostname or ''
    return not any(host == private or host.endswith('.' + private) for private in PRIVATE_HOSTS)

def cala_rows(prompt, slots):
    retries_429, retries_none = 0, 0
    while True:
        with slots:
            result = call_json('knowledge/query', read_key(ROOT / '.env'), {'input': prompt, 'return_entities': True}, 90)
        status = result.get('status')
        if status == 429 and retries_429 < 2:
            retries_429 += 1
            time.sleep(5 if retries_429 == 1 else 15)
            continue
        if status is None and retries_none < 1:
            retries_none += 1
            time.sleep(5)
            continue
        break
    data = result.get('data')
    ok = bool(result.get('ok')) and answer_state(data) in ('data_returned', 'empty')
    rows = []
    if ok and isinstance(data, dict) and isinstance(data.get('results'), list):
        rows = [row for row in data['results'] if isinstance(row, dict)]
    return ok, rows

def people_cache():
    global people_memory
    if people_memory is None:
        try:
            loaded = json.loads(PEOPLE_CACHE.read_text())
        except (OSError, ValueError):
            loaded = {}
        people_memory = loaded if isinstance(loaded, dict) else {}
    return people_memory

def cached_rows(key, prompt, slots, hint=''):
    with people_lock:
        entry = people_cache().get(key)
        if isinstance(entry, dict) and entry.get('prompt') == prompt:
            rows = entry.get('rows')
            return True, rows if isinstance(rows, list) else [], True
    ok, rows = cala_rows(prompt + hint, slots)
    if not ok:
        return False, rows, False
    with people_lock:
        cache = people_cache()
        cache[key] = {'prompt': prompt, 'rows': rows}
        PEOPLE_CACHE.parent.mkdir(exist_ok=True)
        temporary = PEOPLE_CACHE.with_suffix('.tmp')
        temporary.write_text(json.dumps(cache, ensure_ascii=False, indent=1))
        os.replace(temporary, PEOPLE_CACHE)
    return True, rows, False

def clip(value, limit=150):
    return ' '.join(value.split())[:limit] if isinstance(value, str) else ''

def date_text(value):
    if isinstance(value, bool):
        value = ''
    elif isinstance(value, int):
        value = str(value)
    text = clip(value, 30)
    if text.casefold() in ('present', 'current', 'now', 'ongoing'):
        return 'present'
    return text if re.search(r'(?:19|20)\d{2}', text) else None

def listing(items):
    return ', '.join(items[:-1]) + ' and ' + items[-1] if len(items) > 1 else ''.join(items)

def career_prompt(name, fund):
    return (f'For {name} at {fund}, list up to 5 documented current or former professional roles. '
            'One JSON row per role: person, organization, role, start_date, end_date, source_url. '
            'Preserve source date precision, use null for unknown dates, prefer official biographies. '
            'Do not infer personal relationships or introductions from employment.')

def education_prompt(name, fund):
    return (f'For {name} at {fund}, list up to 4 documented educational qualifications. '
            'One JSON row per qualification: person, institution, degree, start_date, end_date, source_url. '
            'Preserve source date precision, use null for unknown dates and degrees, prefer official biographies. '
            'Include only institutions this person attended as a student. '
            'Do not guess institutions, degrees, dates or URLs. If unknown return no rows.')

def boards_prompt(name, fund):
    return (f'For {name} at {fund}, list up to 8 documented board seats and personal angel investments. '
            'One JSON row per item: person, company, relationship, role, start_date, end_date, source_url. '
            f'relationship is "board" for a board member or board observer seat, or "angel" for an investment made personally rather than by {fund}. '
            'role is the board role or the round invested in. '
            'Preserve source date precision, use null for unknown dates and roles. '
            'Include only rows with a direct public source URL naming this person. '
            'Do not guess companies, roles, dates or URLs. If unknown return no rows.')

def coinvestors_prompt(name, fund):
    return (f'List up to 8 investors that most frequently co-invested with {name} of {fund}, or with {fund} in deals that {name} is publicly linked to. '
            'One JSON row per shared deal: co_investor, co_investor_person, company, round_type, announcement_date, source_url. '
            'co_investor is the full name of the other fund or firm, co_investor_person is the named investment professional at that co-investor on the deal or null, '
            'company is the startup both invested in. '
            f'Include only deals with a direct public source URL naming both {fund} and the co-investor in the same round. '
            'Do not guess investors, people, companies, dates or URLs; use null when unknown. If unknown return no rows.')

def background_prompt(subject):
    return (f'Identify the professional background of {subject}. List up to 12 documented items. '
            'One JSON row per item: person, category, organization, role, start_date, end_date, source_url. '
            'category is "role" for a job, "founder" for a company this person founded or co-founded, "education" for a school or university attended, '
            '"board" for a board seat, "advisor" for an advisory role, "angel" for a personal angel investment, or "program" for an accelerator, competition, hackathon, fellowship, award or student organization this person took part in. '
            'organization is the employer, company, school or program. '
            'Preserve source date precision, use null for unknown dates and roles. '
            'Include only rows with a direct public source URL naming this person. '
            'If several people share this name, include only the person matching the description above; if the identity is uncertain, return no rows. '
            'Do not guess organizations, roles, dates or URLs.')

def me_prompt(name, employers, schools, linkedin_url):
    jobs = [e['organization'] + (f" ({e['start'] or '?'}–{e['end'] or 'present'})" if e['start'] or e['end'] else '') for e in employers]
    context = ''
    if jobs:
        context += ', who has worked at ' + listing(jobs)
    if schools:
        context += (' and studied at ' if jobs else ', who studied at ') + listing(schools)
    if linkedin_url:
        context += f'. Their LinkedIn profile is {linkedin_url}'
    return background_prompt(name + context)

def subject_text(name, context):
    return f'{name}, {context}' if context else name

def known_hint(known):
    return (' If an organization in a row is the same as one of these known organizations, write its name exactly as listed here: '
            + ', '.join(known) + '.') if known else ''

def bridge_context(focus, counterpart, focus_people):
    parts = []
    if counterpart and counterpart.get('name'):
        parts.append(f"The other endpoint is {counterpart['name']} ({counterpart.get('context') or 'no further details'}).")
    if focus:
        parts.append(f'The other side has these organizations: {listing(focus)}.')
    if focus_people:
        parts.append(f'People already known on the other side: {listing(focus_people)}.')
    return ' '.join(parts)

def connections_prompt(subject, focus=(), counterpart=None, focus_people=(), include_adjacent=False):
    focus_clause = bridge_context(focus, counterpart, focus_people)
    return (f'Find up to 6 people publicly documented as professionally connected to {subject}, '
            'whose documented background may bridge to the other endpoint. '
            + focus_clause
            + (' If a direct bridge is not known, include at most two well-sourced first-hop colleagues, '
               'co-founders, classmates, teammates, co-authors or co-appearances for further investigation. '
               if include_adjacent else '')
            + ' Do not fill the list with unrelated people; return no rows if evidence is missing. '
            'Include co-founders and business partners, current and former colleagues and managers, '
            'investors in and board members of companies this person founded, founders this person invested in, '
            'classmates and teammates from schools, competitions, hackathons, accelerators or student organizations, co-authors, '
            'and people who appeared together with this person on a panel, podcast, event or in the same article. '
            'Exclude journalists, authors and hosts who only wrote about or interviewed this person, and exclude family members. '
            'Return at most 4 rows for the same organization or event, preferring founders, investors and executives. '
            'One JSON row per connection: person, connected_person, connected_person_role, connected_person_organization, '
            'organization, organization_type, relationship, context, date, source_url. '
            'connected_person is the full name of the other person without titles. connected_person_role is their current role, '
            'connected_person_organization is their current main company, fund or school, or null. '
            'organization is the company, school, event or program where the connection is documented. '
            'organization_type is one of: company, fund, school, event, media, other. '
            "relationship describes the connected person and is one of: co-founder, colleague, investor (invested in or sits on the board of this person's company), "
            'portfolio-founder (founded a company this person invested in), board, classmate, teammate, co-author, co-appearance, advisor, other. '
            'context is one short sentence describing the documented connection. '
            'Include only rows with a direct public source URL that names both people. '
            'Distinguish the exact person using their identity details; the name alone is not proof. '
            'Do not infer employment from an event, investment, or acquaintance. '
            'Do not infer that people know each other personally. Do not guess people, organizations, dates or URLs. If unknown return no rows.')

def org_people_prompt(subject, focus=(), counterpart=None, focus_people=()):
    focus_clause = bridge_context(focus, counterpart, focus_people)
    return (f'Find up to 6 people publicly documented as associated with {subject} who can bridge to the other endpoint. '
            'For a company or fund include founders, executives, current and former employees, board members, advisors and named investors. '
            'For a school, event, competition, accelerator or program include organizers, jury members, mentors, speakers, finalists, winners, alumni, students, researchers and notable participants. '
            + focus_clause
            + ' Do not fill the list with unrelated staff or famous alumni. '
            'One JSON row per person: person, role, relationship, affiliation, start_date, end_date, source_url. '
            'person is the full name without titles. '
            'relationship is one of: founder, executive, employee, investor, board, advisor, organizer, jury, mentor, speaker, participant, alumni, other. '
            "affiliation is the person's own organization when it is different, for example the fund of an investor or the startup of a finalist, otherwise null. "
            'Preserve source date precision, use null for unknown dates and roles. '
            'Include only rows with a direct public source URL supporting the role and affiliation. '
            'Do not guess people, roles, dates or URLs. If unknown return no rows.')

DOSSIER_PARTS = (('career', career_prompt), ('education', education_prompt), ('boards', boards_prompt), ('coinvestors', coinvestors_prompt))
DOSSIER_LIMITS = {'career': 5, 'education': 4, 'boards': 8, 'coinvestors': 8}

def same_fund(a, b):
    x, y = a.casefold(), b.casefold()
    return x == y or x.startswith(y + ' ') or y.startswith(x + ' ')

def dossier_fact(part, row):
    if not isinstance(row, dict) or not valid_source(row.get('source_url')):
        return None
    extra = {}
    if part == 'career':
        role = row.get('role')
        kind = 'board' if re.search(r'\bboard\b', clip(role).casefold()) else 'role'
        organization = row.get('organization')
        start, end = row.get('start_date'), row.get('end_date')
    elif part == 'education':
        kind, organization, role = 'education', row.get('institution'), row.get('degree')
        start, end = row.get('start_date'), row.get('end_date')
    elif part == 'boards':
        relationship = clip(row.get('relationship')).casefold()
        if 'board' in relationship:
            kind = 'board'
        elif 'angel' in relationship:
            kind = 'angel'
        else:
            return None
        organization, role = row.get('company'), row.get('role')
        start, end = row.get('start_date'), row.get('end_date')
    elif part == 'coinvestors':
        kind, organization, role = 'coinvestor', row.get('co_investor'), row.get('round_type')
        start, end = row.get('announcement_date'), None
        extra = {'company': clip(row.get('company')), 'person': clip(row.get('co_investor_person'))}
        if not extra['company']:
            return None
    else:
        return None
    organization = clip(organization)
    if not organization:
        return None
    fact = {'kind': kind, 'organization': organization, 'role': clip(role),
            'start': date_text(start), 'end': date_text(end), 'source_url': row['source_url']}
    if extra:
        fact['company'] = extra['company']
        if extra['person'] and len(extra['person']) <= 60 and not any(c in extra['person'] for c in '(;:'):
            fact['person'] = extra['person']
    return fact

def dossier_facts(name, fund):
    def run(part, prompt):
        return part, cached_rows(f'dossier|{part}|{name.casefold()}|{fund.casefold()}', prompt(name, fund), dossier_slots)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda item: run(*item), DOSSIER_PARTS))
    facts, seen, failed, counts = [], set(), [], {part: 0 for part, _ in DOSSIER_PARTS}
    cached = all(hit for _, (_, _, hit) in results)
    for part, (ok, rows, _) in results:
        if not ok:
            failed.append(part)
            continue
        for row in rows:
            fact = dossier_fact(part, row)
            if fact is None:
                continue
            key = (fact['kind'], fact['organization'].casefold(), fact['role'].casefold(), fact['start'], fact.get('company', '').casefold())
            if key in seen or counts[part] == DOSSIER_LIMITS[part]:
                continue
            seen.add(key)
            counts[part] += 1
            facts.append(fact)
    return facts, cached, failed

def saved_dossier(name, fund):
    try:
        records = json.loads(SAVED_DOSSIERS.read_text()).get('dossiers')
    except (OSError, ValueError, AttributeError):
        return None
    for record in records if isinstance(records, list) else []:
        if not isinstance(record, dict):
            continue
        if isinstance(record.get('name'), str) and isinstance(record.get('fund'), str) \
                and record['name'].casefold() == name.casefold() and same_fund(record['fund'], fund):
            return record
    return None

def me_facts(rows):
    facts, seen = [], set()
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        category = clip(row.get('category')).casefold()
        if category == 'founder':
            kind = 'role'
            role = clip(row.get('role'))
            if 'found' not in role.casefold():
                role = 'Founder' + (', ' + role if role else '')
        elif category in ('role', 'education', 'board', 'advisor', 'angel', 'program'):
            kind, role = category, clip(row.get('role'))
        else:
            continue
        organization = clip(row.get('organization'))
        if not organization or not valid_source(row.get('source_url')):
            continue
        fact = {'kind': kind, 'organization': organization, 'role': role,
                'start': date_text(row.get('start_date')), 'end': date_text(row.get('end_date')),
                'source_url': row['source_url']}
        key = (category, organization.casefold(), role.casefold(), fact['start'])
        if key in seen:
            continue
        seen.add(key)
        facts.append(fact)
        if len(facts) == 12:
            break
    return facts

RELATIONSHIPS = ('co-founder', 'colleague', 'investor', 'portfolio-founder', 'board', 'classmate', 'teammate', 'co-author', 'co-appearance', 'advisor', 'other')
VIA_TYPES = ('company', 'fund', 'school', 'event', 'media', 'other')
ORG_RELATIONSHIPS = ('founder', 'executive', 'employee', 'investor', 'board', 'advisor', 'organizer', 'jury', 'mentor', 'speaker', 'participant', 'alumni', 'other')
NOT_A_PERSON = re.compile(r'\b(vc|ventures?|capital|partners|fund|inc|ltd|llc|gmbh|group|holdings?|university|uniwersytet|politechnika|foundation|team|unknown|undisclosed)\b', re.I)
TITLES = re.compile(r'^(?:(?:dr|prof|mgr|inż|hab|mr|mrs|ms)\.?\s+)+', re.I)

def person_name(value):
    text = TITLES.sub('', clip(value, 120))
    if not 3 <= len(text) <= 80 or ' ' not in text or NOT_A_PERSON.search(text) \
            or any(c.isdigit() or c in '()[];:/@&' for c in text):
        return ''
    return text

def linkedin_person_url(value):
    if not valid_source(value):
        return ''
    parsed = urlsplit(value)
    host = (parsed.hostname or '').casefold()
    if (host != 'linkedin.com' and not host.endswith('.linkedin.com')) or not parsed.path.startswith('/in/'):
        return ''
    return value

def connection_rows(rows, subject_name):
    connections, seen = [], set()
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        name = person_name(row.get('connected_person'))
        if not name or name.casefold() == subject_name.casefold() or not valid_source(row.get('source_url')):
            continue
        relationship = clip(row.get('relationship')).casefold()
        if relationship not in RELATIONSHIPS:
            relationship = 'other'
        via = clip(row.get('organization'), 120)
        via_type = clip(row.get('organization_type')).casefold()
        if via_type not in VIA_TYPES:
            via_type = 'other'
        key = (name.casefold(), relationship, via.casefold())
        if key in seen:
            continue
        seen.add(key)
        connection = {'name': name, 'role': clip(row.get('connected_person_role')),
                      'organization': clip(row.get('connected_person_organization'), 120),
                      'via': via, 'via_type': via_type, 'relationship': relationship,
                      'context': clip(row.get('context'), 300), 'date': date_text(row.get('date')),
                      'source_url': row['source_url']}
        profile = linkedin_person_url(row.get('profile_url')) or linkedin_person_url(row['source_url'])
        if profile:
            connection['profile_url'] = profile
        connections.append(connection)
        if len(connections) == 14:
            break
    return connections

def org_people_rows(rows):
    people, seen = [], set()
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        name = person_name(row.get('person'))
        if not name or not valid_source(row.get('source_url')):
            continue
        relationship = clip(row.get('relationship')).casefold()
        if relationship not in ORG_RELATIONSHIPS:
            relationship = 'other'
        key = (name.casefold(), relationship)
        if key in seen:
            continue
        seen.add(key)
        person = {'name': name, 'role': clip(row.get('role')), 'relationship': relationship,
                  'affiliation': clip(row.get('affiliation'), 120),
                  'start': date_text(row.get('start_date')), 'end': date_text(row.get('end_date')),
                  'source_url': row['source_url']}
        profile = linkedin_person_url(row.get('profile_url')) or linkedin_person_url(row['source_url'])
        if profile:
            person['profile_url'] = profile
        people.append(person)
        if len(people) == 14:
            break
    return people

def entity_cache():
    global entity_memory
    if entity_memory is None:
        try:
            loaded = json.loads(ENTITIES_CACHE.read_text())
        except (OSError, ValueError):
            loaded = {}
        entity_memory = loaded if isinstance(loaded, dict) else {}
    return entity_memory

def cached_entity(key, compute):
    with entity_lock:
        cache = entity_cache()
        entry = cache.get(key)
        if key in cache and isinstance(entry, (dict, list)):
            return entry, True
    value = compute()
    if value is None:
        return None, False
    with entity_lock:
        cache = entity_cache()
        cache[key] = value
        ENTITIES_CACHE.parent.mkdir(exist_ok=True)
        temporary = ENTITIES_CACHE.with_suffix('.tmp')
        temporary.write_text(json.dumps(cache, ensure_ascii=False, indent=1))
        os.replace(temporary, ENTITIES_CACHE)
    return value, False

def cala_entity(path, body=None, timeout=30):
    with network_slots:
        return call_json(path, read_key(ROOT / '.env'), body, timeout)

def normalized_identity(value):
    text = unicodedata.normalize('NFKD', value.casefold()).replace('ł', 'l')
    text = ''.join(c for c in text if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', ' ', text).strip()

def org_overlap(a, b):
    na, nb = normalized_identity(a), normalized_identity(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    suffixes = {'inc', 'ltd', 'llc', 'gmbh', 'technologies', 'technology', 'capital', 'ai'}
    def strip_suffix(name):
        words = name.split()
        while len(words) > 1 and words[-1] in suffixes:
            words.pop()
        return ' '.join(words)
    return strip_suffix(na) == strip_suffix(nb)

def cache_fingerprint(*values):
    text = json.dumps(values, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(text.encode()).hexdigest()

def any_focus_match(orgs, focus):
    return bool(focus) and any(org_overlap(org, term) for org in orgs if org for term in focus)

def openai_search(cache_key, subject, kind, focus, counterpart=None, focus_people=(), include_adjacent=False):
    """Return cited rows, or None on failure; failures are never cached."""
    def search():
        try:
            key = read_key(ROOT / '.env', 'OPENAI_API_KEY')
        except ValueError:
            return None
        with openai_slots:
            rows = search_people(subject, kind, focus, key, counterpart=counterpart,
                                 focus_people=focus_people, include_adjacent=include_adjacent)
        return rows if isinstance(rows, list) else None
    rows, _ = cached_entity(cache_key, search)
    return rows

CONTEXT_WORDS = re.compile(r'[a-z0-9]{4,}')
NOT_ORG_TYPES = {'Person', 'Product', 'Country', 'Municipality', 'Industry', 'Language', 'PrivateCompanyFundingRound'}

def pick_entity(candidates, name, want_person, context):
    pool = [e for e in candidates if (e.get('entity_type') == 'Person') == want_person]
    if not want_person:
        pool = [e for e in pool if e.get('entity_type') not in NOT_ORG_TYPES]
    pool = [e for e in pool if normalized_identity(str(e.get('name') or '')) == normalized_identity(name)]
    if len(pool) == 1:
        return pool[0]
    if not pool:
        return None
    words = set(CONTEXT_WORDS.findall(context.casefold()))
    def score(e):
        text = (str(e.get('name') or '') + ' ' + str(e.get('description') or '')).casefold()
        return sum(1 for word in words if word in text)
    pool.sort(key=score, reverse=True)
    if words and score(pool[0]) > score(pool[1]):
        return pool[0]
    return None

def resolve_entity(name, want_person, context, identity_orgs=(), profile_url=''):
    def compute():
        result = cala_entity('entities?' + urlencode({'name': name, 'limit': 8}))
        if not result.get('ok'):
            return None
        candidates = [e for e in (result.get('data') or {}).get('entities') or []
                      if isinstance(e, dict) and e.get('id')]
        picked = pick_entity(candidates, name, want_person, context)
        return {'entity': {k: picked.get(k) for k in ('id', 'name', 'entity_type', 'description')} if picked else None}
    key = cache_fingerprint(name.casefold(), want_person, context.casefold(),
                            sorted(identity_orgs), profile_url)
    entry, hit = cached_entity(f'resolve|v2|{key}', compute)
    return (entry or {}).get('entity'), hit

def entity_matches_identity(entity, graph, identity_orgs, profile_url):
    """A same-name Cala entity is not enough to attach its relationships to a person."""
    if not entity:
        return False
    if profile_url:
        data = json.dumps([entity, graph], ensure_ascii=False).casefold()
        if profile_url.rstrip('/').casefold() in data:
            return True
    description = normalized_identity(str(entity.get('description') or ''))
    for org in identity_orgs:
        normalized = normalized_identity(org)
        if len(normalized) >= 4 and re.search(r'(?<![a-z0-9])' + re.escape(normalized) + r'(?![a-z0-9])', description):
            return True
    for relation, item in relation_items(graph, 'outgoing'):
        if relation not in ('WORKS_AT', 'IS_EXECUTIVE_OF', 'FOUNDED', 'STUDIED_AT',
                            'EDUCATED_AT', 'IS_BOARD_MEMBER_OF', 'IS_ADVISOR_OF'):
            continue
        label = clip(item.get('name'), 120)
        if label and any(org_overlap(label, org) for org in identity_orgs):
            return True
    return False

def entity_graph(entity_id):
    def compute():
        schema = cala_entity(f'entities/{entity_id}/introspection')
        if not schema.get('ok'):
            return None
        data = schema.get('data') or {}
        relationships = data.get('relationships') or {}
        body = {'properties': data.get('properties') or [],
                'relationships': {direction: {relation: {'limit': 50, 'offset': 0}
                                              for relation in relations}
                                  for direction, relations in relationships.items()
                                  if direction in ('incoming', 'outgoing') and isinstance(relations, list)}}
        result = cala_entity(f'entities/{entity_id}', body, 60)
        if not result.get('ok'):
            return None
        return {'data': result.get('data')}
    entry, hit = cached_entity(f'graph|{entity_id}', compute)
    return (entry or {}).get('data'), hit

def relation_items(data, direction):
    for relation, items in ((data or {}).get('relationships') or {}).get(direction, {}).items():
        for item in items if isinstance(items, list) else []:
            if isinstance(item, dict):
                yield relation, item

def edge_props(item):
    props = item.get('properties') or {}
    source = ''
    for entry in props.get('sources') or []:
        if isinstance(entry, dict) and valid_source(entry.get('document')):
            source = entry['document']
            break
    return clip(props.get('role')), date_text(props.get('valid_since') or props.get('start_date') or props.get('event_date')), date_text(props.get('valid_until') or props.get('end_date')), source

ORG_EDGE_REL = {
    'WORKS_AT': 'employee', 'FOUNDED': 'founder', 'INVESTED_IN': 'investor',
    'IS_BOARD_MEMBER_OF': 'board', 'IS_EXECUTIVE_OF': 'executive', 'IS_ADVISOR_OF': 'advisor',
    'STUDIED_AT': 'alumni', 'EDUCATED_AT': 'alumni',
}
ORG_OUTGOING_REL = {'OPERATED_BY': 'executive', 'EMPLOYS': 'employee'}
EXECUTIVE_ROLE = re.compile(r'\b(ceo|cto|cfo|coo|chief|president|managing|general partner|partner|founder|head|director|vp)\b', re.I)

def graph_org_people(data, context=''):
    people, seen = [], set()
    for direction in ('incoming', 'outgoing'):
        for relation, item in relation_items(data, direction):
            if item.get('entity_type') != 'Person':
                continue
            name = person_name(item.get('name'))
            role, start, end, source = edge_props(item)
            if not name or not source:
                continue
            relationship = (ORG_EDGE_REL if direction == 'incoming' else ORG_OUTGOING_REL).get(relation)
            if relation == 'ATTENDED' and direction == 'incoming':
                if 'school' in context or 'university' in context:
                    relationship = 'alumni'
                elif 'event' in context or 'program' in context:
                    relationship = 'participant'
            if not relationship:
                continue
            if relationship == 'employee' and EXECUTIVE_ROLE.search(role):
                relationship = 'executive'
            key = (name.casefold(), relationship)
            if key in seen:
                continue
            seen.add(key)
            people.append({'name': name, 'role': role, 'relationship': relationship,
                           'affiliation': '', 'start': start, 'end': end, 'source_url': source})
            if len(people) == 14:
                return people
    return people

PERSON_EDGE_KIND = {
    'WORKS_AT': 'role', 'IS_EXECUTIVE_OF': 'role', 'IS_ADVISOR_OF': 'advisor', 'FOUNDED': 'role',
    'STUDIED_AT': 'education', 'EDUCATED_AT': 'education',
    'IS_BOARD_MEMBER_OF': 'board', 'PARTICIPATED_IN': 'program',
}
PERSON_EDGE_CONN = {'CO_FOUNDED': 'co-founder', 'CO_FOUNDED_BY': 'co-founder',
                    'WORKED_WITH': 'colleague', 'APPEARED_WITH': 'co-appearance',
                    'STUDIED_WITH': 'classmate', 'ADVISED': 'advisor', 'MENTORED': 'advisor'}
PERSON_EDGE_SKIP = {'SPOUSE_OF', 'MARRIED_TO', 'SIBLING_OF', 'CHILD_OF', 'PARENT_OF', 'RELATED_TO'}

def graph_person_facts(data):
    facts, seen = [], set()
    for relation, item in relation_items(data, 'outgoing'):
        if item.get('entity_type') in NOT_ORG_TYPES:
            continue
        kind = PERSON_EDGE_KIND.get(relation)
        if not kind:
            continue
        organization = clip(item.get('name'), 120)
        role, start, end, source = edge_props(item)
        if relation == 'FOUNDED':
            kind = 'role'
            if 'found' not in role.casefold():
                role = 'Founder' + (', ' + role if role else '')
        key = (kind, organization.casefold(), role.casefold())
        if not organization or not source or key in seen:
            continue
        seen.add(key)
        facts.append({'kind': kind, 'organization': organization, 'role': role,
                      'start': start, 'end': end, 'source_url': source})
        if len(facts) == 12:
            break
    return facts

def graph_person_connections(data, subject_name):
    connections, seen = [], set()
    for direction in ('incoming', 'outgoing'):
        for relation, item in relation_items(data, direction):
            if item.get('entity_type') != 'Person' or relation in PERSON_EDGE_SKIP:
                continue
            name = person_name(item.get('name'))
            role, start, end, source = edge_props(item)
            if not name or name.casefold() == subject_name.casefold() or not source:
                continue
            relationship = PERSON_EDGE_CONN.get(relation, 'other')
            if relationship == 'other':
                continue
            if relation in ('ADVISED', 'MENTORED'):
                relationship = 'other'
            key = (name.casefold(), relationship)
            if key in seen:
                continue
            seen.add(key)
            connections.append({'name': name, 'role': '', 'organization': '',
                                'via': '', 'via_type': 'other', 'relationship': relationship,
                                'context': f'Connected by {relation.lower().replace("_", " ")} in the Cala entity graph',
                                'date': start, 'source_url': source})
            if len(connections) == 6:
                return connections
    return connections

def with_origin(rows, origin):
    return [dict(row, origin=origin, **({'certainty': 'inferred'} if origin == 'openai' else {}))
            for row in rows]

def bridge_relevant(row, focus, counterpart, focus_people):
    names = list(focus_people)
    if counterpart and counterpart.get('name'):
        names.append(counterpart['name'])
    if any(normalized_identity(row.get('name', '')) == normalized_identity(name) for name in names):
        return True
    organizations = [row.get('affiliation', ''), row.get('organization', ''), row.get('via', '')]
    return any_focus_match(organizations, focus)

ADJACENT_RELATIONSHIPS = {
    'co-founder', 'colleague', 'classmate', 'teammate', 'co-author', 'co-appearance',
    'investor', 'portfolio-founder', 'board', 'advisor',
}

def adjacent_connections(rows, relevant):
    return [row for row in rows if not relevant(row)
            and row.get('relationship') in ADJACENT_RELATIONSHIPS
            and valid_source(row.get('source_url'))]

def merge_search_rows(groups, fields, limit=8):
    result, seen = [], {}
    for rows in groups:
        for row in rows:
            key = tuple(str(row.get(field) or '').casefold() for field in fields)
            source = {'url': row.get('source_url', ''), 'origin': row.get('origin', '')}
            inherited = row.get('sources') if isinstance(row.get('sources'), list) else []
            incoming = [item for item in [source, *inherited]
                        if isinstance(item, dict) and item.get('url')]
            if key in seen:
                sources = seen[key].setdefault('sources', [])
                for item in incoming:
                    if item not in sources:
                        sources.append(item)
                continue
            if len(result) >= limit:
                continue
            item = dict(row)
            item['sources'] = []
            for entry in incoming:
                if entry not in item['sources']:
                    item['sources'].append(entry)
            seen[key] = item
            result.append(item)
    return result

def cached_linkedin(identity):
    with linkedin_lock:
        try:
            return json.loads(LINKEDIN_CACHE.read_text()).get(identity)
        except (OSError, ValueError):
            return None

def save_linkedin(identity, profile):
    with linkedin_lock:
        try:
            cache = json.loads(LINKEDIN_CACHE.read_text())
        except (OSError, ValueError):
            cache = {}
        cache[identity] = profile
        LINKEDIN_CACHE.parent.mkdir(exist_ok=True)
        temporary = LINKEDIN_CACHE.with_suffix('.tmp')
        temporary.write_text(json.dumps(cache, ensure_ascii=False, indent=1))
        os.replace(temporary, LINKEDIN_CACHE)

def parse_person_investments(rows):
    investments, seen = [], set()
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        company, url = row.get('company'), row.get('source_url')
        if not isinstance(company, str) or not company.strip() or len(company.strip()) > 100:
            continue
        if not isinstance(url, str) or not url.startswith(('https://', 'http://')) or any(c.isspace() for c in url):
            continue
        key = company.strip().casefold()
        if key in seen:
            continue
        seen.add(key)
        investments.append({'company': company.strip(),
                            'round_type': str(row.get('round_type') or '')[:60],
                            'announcement_date': str(row.get('announcement_date') or '')[:60],
                            'person_role': str(row.get('person_role') or '')[:150],
                            'source_url': url})
        if len(investments) == 8:
            break
    return investments

def parse_fund_paths(rows, excluded):
    companies = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        name, round_type, date = (row.get(k) for k in ('company', 'round_type', 'announcement_date'))
        if not all(isinstance(x, str) and x.strip() for x in (name, round_type, date)) or len(name.strip()) > 100:
            continue
        key = name.strip().casefold()
        if key in excluded:
            continue
        if key not in companies:
            if len(companies) == 6:
                continue
            companies[key] = {'company': name.strip(), 'rounds': [], 'cached': False}
        companies[key]['rounds'].append({k: row.get(k) for k in ('company', 'round_type', 'announcement_date', 'lead_investors', 'investors', 'source_urls')})
    return list(companies.values())

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def json_response(self, status, value):
        data = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if urlsplit(self.path).path == '/api/examples':
            summary = json.loads((ROOT / 'research/results-summary.json').read_text())
            names = sorted({row['company'] for row in summary['round_records']})
            return self.json_response(200, {'names': names})
        return super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path not in ('/api/search', '/api/partners', '/api/similar', '/api/risks', '/api/fund-paths', '/api/person-investments', '/api/linkedin', '/api/founders',
                        '/api/me', '/api/dossier', '/api/network', '/api/rank'):
            return self.json_response(404, {'error': 'Endpoint not found.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length > (16384 if path in ('/api/me', '/api/dossier', '/api/network', '/api/rank') else 4096):
                return self.json_response(413, {'error': 'Request is too long.'})
            payload = json.loads(self.rfile.read(length))
            if path == '/api/risks':
                idea = payload.get('idea', '')
                funds = payload.get('funds', [])
                if not isinstance(idea, str) or not 15 <= len(idea.strip()) <= 2000 or not isinstance(funds, list) or len(funds) > 6 or any(not isinstance(f, str) or len(f) > 120 for f in funds):
                    return self.json_response(400, {'error': 'Invalid startup description or fund list.'})
                if not funds:
                    return self.json_response(200, {'risks': []})
                prompt = ('For this startup idea, identify only documented potential direct portfolio conflicts among these funds: '
                          + ', '.join(funds) + '. Idea: ' + idea.strip() + '. '
                          'Return one JSON row per conflict with fields fund, competitor, reason, source_url. '
                          'A conflict requires a named portfolio company solving the same specific problem for similar customers, '
                          'and a direct public source showing the fund invested in that company. '
                          'Do not infer conflicts from general industry overlap, unknown portfolio, lack of investment, or co-investment. '
                          'Write descriptive text in English. Do not invent facts or URLs. If there is no supported example, return no rows.')
                result = call_json('knowledge/query', read_key(ROOT / '.env'), {'input': prompt, 'return_entities': True}, 90)
                if not result['ok'] or answer_state(result.get('data')) not in ('data_returned', 'empty'):
                    return self.json_response(502, {'error': 'Could not check conflicts with Cala.'})
                data = result.get('data', {})
                rows = data.get('results', []) if isinstance(data, dict) else []
                risks = []
                for row in rows if isinstance(rows, list) else []:
                    if not isinstance(row, dict):
                        continue
                    fund, competitor, reason, url = (row.get(k) for k in ('fund', 'competitor', 'reason', 'source_url'))
                    if not all(isinstance(x, str) and x.strip() for x in (fund, competitor, reason, url)):
                        continue
                    if fund.casefold() not in {f.casefold() for f in funds} or not url.startswith(('http://', 'https://')) or any(c.isspace() for c in url):
                        continue
                    risks.append({'fund': fund, 'competitor': competitor, 'reason': reason, 'source_url': url})
                return self.json_response(200, {'risks': risks[:5]})
            if path == '/api/similar':
                idea = payload.get('idea', '')
                if not isinstance(idea, str) or not 15 <= len(idea.strip()) <= 2000:
                    return self.json_response(400, {'error': 'Describe your idea in 15–2000 characters.'})
                prompt = ("Find up to 4 real venture-backed startup companies with products, customers and business models similar to this startup idea. "
                          "For each, return one JSON row with fields company, description, similarity_reason, website, source_url. "
                          "Use names of existing companies, explain concrete similarity in English, and include a direct public source URL. "
                          "Write the descriptions in English. "
                          "Do not fabricate companies, sources, investment outcomes or match percentages. "
                          "If no reliable match is known, return no rows. Startup idea: " + idea.strip())
                result = call_json('knowledge/query', read_key(ROOT / '.env'), {'input': prompt, 'return_entities': True}, 90)
                if not result['ok'] or answer_state(result.get('data')) not in ('data_returned', 'empty'):
                    return self.json_response(502, {'error': 'Cala returned no results. Try a shorter description of your product and customers.'})
                rows = result.get('data', {}).get('results', [])
                matches = []
                for row in rows if isinstance(rows, list) else []:
                    if not isinstance(row, dict):
                        continue
                    name = row.get('company') or row.get('name')
                    if not isinstance(name, str) or not name.strip() or len(name) > 100:
                        continue
                    matches.append({'company': name.strip(), 'description': str(row.get('description') or ''),
                                    'similarity_reason': str(row.get('similarity_reason') or row.get('reason') or ''),
                                    'source_url': str(row.get('source_url') or row.get('website') or '')})
                return self.json_response(200, {'matches': matches[:4]})
            if path == '/api/partners':
                company = str(payload.get('company', '')).strip()
                fund = str(payload.get('fund', '')).strip()
                if not company or not fund or len(company) > 100 or len(fund) > 120:
                    return self.json_response(400, {'error': 'A fund and startup name are required.'})
                identity = (company.casefold(), fund.casefold())
                for (known_company, known_fund), people in PARTNERS.items():
                    if identity[0] == known_company and (identity[1] == known_fund or identity[1].startswith(known_fund + ' ')):
                        return self.json_response(200, {'partners': people, 'origin': 'saved'})
                if identity in partner_cache:
                    return self.json_response(200, {'partners': partner_cache[identity], 'origin': 'cache'})
                prompt = (f'Identify up to 3 investment professionals at {fund} publicly linked to its investment in {company}. '
                          'Return one row per person with fields name, fund, role, connection, source_url. '
                          'Include a direct public source URL explicitly linking the person to this investment. '
                          'Write roles and connections in English. Do not guess people, roles, introductions or email addresses. If unknown return no rows.')
                with partner_slots:
                    result = call_json('knowledge/query', read_key(ROOT / '.env'), {'input': prompt, 'return_entities': True}, 90)
                if not result['ok']:
                    return self.json_response(502, {'error': 'Could not retrieve contacts from Cala.'})
                data = result.get('data', {})
                if answer_state(data) == 'fallback':
                    return self.json_response(502, {'error': 'Cala could not answer this question.'})
                rows = data.get('results', []) if isinstance(data, dict) else []
                people = []
                for row in rows if isinstance(rows, list) else []:
                    if not isinstance(row, dict):
                        continue
                    person, source = row.get('name'), row.get('source_url')
                    if not isinstance(person, str) or not isinstance(source, str):
                        continue
                    if not person.strip() or not source.startswith(('https://', 'http://')) or any(c.isspace() for c in source):
                        continue
                    people.append({'name': person[:150], 'role': str(row.get('role') or '')[:150], 'connection': str(row.get('connection') or '')[:300], 'source_url': source})
                partner_cache[identity] = people[:3]
                return self.json_response(200, {'partners': people[:3], 'origin': 'cala'})
            if path == '/api/founders':
                company, context = payload.get('company', ''), payload.get('context', '')
                if (not isinstance(company, str) or not company.strip() or len(company) > 100
                        or not isinstance(context, str) or len(context) > 1000):
                    return self.json_response(400, {'error': 'A startup name is required.'})
                company = company.strip()
                identity = company.casefold()
                if identity in FOUNDERS:
                    return self.json_response(200, {'founders': FOUNDERS[identity], 'origin': 'saved'})
                if identity in founders_cache:
                    return self.json_response(200, {'founders': founders_cache[identity], 'origin': 'cache'})
                prompt = (f'List up to 4 founders of the startup {company}. '
                          'Return one row per founder with fields name, role, source_url. '
                          "role is the founder's current or founding role at the company, for example Co-founder and CEO. "
                          'Include a direct public source URL that names the person as a founder of this company. '
                          'Write roles in English. Do not guess people, roles or URLs. If unknown return no rows.')
                if context.strip():
                    prompt += (' The intended company is described here: ' + context.strip() +
                               '. Exclude different companies with the same or similar name.')
                with founder_slots:
                    result = call_json('knowledge/query', read_key(ROOT / '.env'), {'input': prompt, 'return_entities': True}, 90)
                if not result['ok']:
                    return self.json_response(502, {'error': 'Could not retrieve founders from Cala.'})
                data = result.get('data', {})
                if answer_state(data) == 'fallback':
                    return self.json_response(502, {'error': 'Cala could not answer this question.'})
                rows = data.get('results', []) if isinstance(data, dict) else []
                founders, seen = [], set()
                for row in rows if isinstance(rows, list) else []:
                    if not isinstance(row, dict):
                        continue
                    person, source = row.get('name'), row.get('source_url')
                    if not isinstance(person, str) or not isinstance(source, str):
                        continue
                    if not person.strip() or not source.startswith(('https://', 'http://')) or any(c.isspace() for c in source):
                        continue
                    if person.strip().casefold() in seen:
                        continue
                    seen.add(person.strip().casefold())
                    founders.append({'name': person.strip()[:150], 'role': str(row.get('role') or '')[:150], 'source_url': source})
                founders_cache[identity] = founders[:4]
                return self.json_response(200, {'founders': founders[:4], 'origin': 'cala'})
            if path == '/api/linkedin':
                name = payload.get('name', '')
                kind = 'startup' if 'company' in payload else 'fund'
                organization = payload.get('company' if kind == 'startup' else 'fund', '')
                if (not isinstance(name, str) or not name.strip() or len(name) > 150
                        or not isinstance(organization, str) or not organization.strip() or len(organization) > 120):
                    return self.json_response(400, {'error': 'A person and a fund or startup are required.'})
                name, organization = ' '.join(name.split()), ' '.join(organization.split())
                identity = f'{name.casefold()}|{organization.casefold()}'
                profile, origin = cached_linkedin(identity), 'cache'
                if not profile:
                    try:
                        key = read_key(ROOT / '.env', 'OPENAI_API_KEY')
                    except ValueError:
                        return self.json_response(503, {'error': 'Set OPENAI_API_KEY in .env to look up LinkedIn profiles.'})
                    with linkedin_slots:
                        profile = find_profile(name, organization, kind, key)
                    if profile is None:
                        return self.json_response(502, {'error': 'Could not look up the LinkedIn profile.'})
                    origin = 'openai'
                    save_linkedin(identity, profile)
                if profile.get('url') and 'photo' not in profile:
                    fetched, photo = fetch_photo(profile['url'])
                    if fetched:
                        profile = {**profile, 'photo': photo}
                        save_linkedin(identity, profile)
                return self.json_response(200, {'url': profile.get('url'), 'evidence': profile.get('evidence'),
                                                'photo': profile.get('photo'), 'origin': origin})
            if path == '/api/fund-paths':
                fund, stage, exclude = payload.get('fund', ''), payload.get('stage', ''), payload.get('exclude', [])
                if (not isinstance(fund, str) or not fund.strip() or len(fund) > 120 or stage not in FUND_PATH_STAGES
                        or not isinstance(exclude, list) or len(exclude) > 8 or any(not isinstance(e, str) or len(e) > 100 for e in exclude)):
                    return self.json_response(400, {'error': 'Invalid fund or stage.'})
                fund = fund.strip()
                names = sorted({e.strip() for e in exclude if e.strip()})
                excluded = {n.casefold() for n in names}
                identity = (fund.casefold(), stage, tuple(sorted(excluded)))
                if identity in fund_paths_cache:
                    return self.json_response(200, {'companies': fund_paths_cache[identity], 'origin': 'cache'})
                first, later = FUND_PATH_STAGES[stage]
                prompt = (f'List up to 6 venture-backed startups in which {fund} led or co-led {first}'
                          + (f', excluding {", ".join(names)}' if names else '') + '. '
                          f'For each startup return one row for that round and one row for the first {later} of the same startup, if publicly announced. '
                          'Row fields: company, round_type, announcement_date, lead_investors, investors, source_urls. '
                          'Use full investor names and include a direct public source URL for every row. '
                          'Do not invent companies, rounds, dates, investors or URLs; use null when unknown. '
                          'If no reliable example is known, return no rows.')
                with fund_slots:
                    result = call_json('knowledge/query', read_key(ROOT / '.env'), {'input': prompt, 'return_entities': True}, 90)
                if not result['ok']:
                    return self.json_response(502, {'error': 'Could not retrieve examples from Cala.'})
                data = result.get('data', {})
                if answer_state(data) == 'fallback':
                    return self.json_response(502, {'error': 'Cala could not answer this question.'})
                companies = parse_fund_paths(data.get('results', []) if isinstance(data, dict) else [], excluded)
                fund_paths_cache[identity] = companies
                return self.json_response(200, {'companies': companies, 'origin': 'cala'})
            if path == '/api/person-investments':
                name, fund = payload.get('name', ''), payload.get('fund', '')
                if (not isinstance(name, str) or not name.strip() or len(name) > 150
                        or not isinstance(fund, str) or not fund.strip() or len(fund) > 120):
                    return self.json_response(400, {'error': 'A person and fund are required.'})
                name, fund = name.strip(), fund.strip()
                identity = (name.casefold(), fund.casefold())
                if identity in person_cache:
                    return self.json_response(200, {'investments': person_cache[identity], 'origin': 'cache'})
                prompt = (f'List up to 8 startups in which {name} of {fund} is publicly linked to an investment made by {fund}. '
                          'Return one row per startup with fields company, round_type, announcement_date, person_role, source_url. '
                          'person_role describes the documented link, for example led the investment, board member or quoted in the announcement. '
                          'Include only rows with a direct public source URL explicitly linking this person to that investment. '
                          'Write person_role in English. Do not guess people, investments, roles, dates or URLs; use null when unknown. If unknown return no rows.')
                with person_slots:
                    result = call_json('knowledge/query', read_key(ROOT / '.env'), {'input': prompt, 'return_entities': True}, 90)
                if not result['ok']:
                    return self.json_response(502, {'error': 'Could not retrieve investments from Cala.'})
                data = result.get('data', {})
                if answer_state(data) == 'fallback':
                    return self.json_response(502, {'error': 'Cala could not answer this question.'})
                investments = parse_person_investments(data.get('results', []) if isinstance(data, dict) else [])
                person_cache[identity] = investments
                return self.json_response(200, {'investments': investments, 'origin': 'cala'})
            if path == '/api/me':
                name, linkedin_url = payload.get('name', ''), payload.get('linkedin_url', '')
                employers, schools = payload.get('employers', []), payload.get('schools', [])
                if (not isinstance(name, str) or not 1 <= len(name.strip()) <= 150
                        or not isinstance(employers, list) or len(employers) > 12
                        or any(not isinstance(e, dict) or not isinstance(e.get('organization'), str)
                               or not 1 <= len(e['organization'].strip()) <= 120
                               or not isinstance(e.get('start', ''), str) or len(e.get('start', '').strip()) > 20
                               or not isinstance(e.get('end', ''), str) or len(e.get('end', '').strip()) > 20 for e in employers)
                        or not isinstance(schools, list) or len(schools) > 8
                        or any(not isinstance(s, str) or not 1 <= len(s.strip()) <= 120 for s in schools)):
                    return self.json_response(400, {'error': 'Enter your name and valid employers and schools.'})
                linkedin_url = linkedin_url.strip() if isinstance(linkedin_url, str) else linkedin_url
                if (not isinstance(linkedin_url, str) or (linkedin_url
                        and (not valid_source(linkedin_url) or 'linkedin.com/' not in linkedin_url or len(linkedin_url) > 200))):
                    return self.json_response(400, {'error': 'Enter a valid LinkedIn profile URL.'})
                name = clip(name)
                jobs = [{'organization': clip(e['organization']), 'start': clip(e.get('start', '')), 'end': clip(e.get('end', ''))} for e in employers]
                prompt = me_prompt(name, jobs, [clip(s) for s in schools], clip(linkedin_url))
                ok, rows, cached = cached_rows(f'me|{name.casefold()}', prompt, me_slots)
                if not ok:
                    return self.json_response(502, {'error': 'Could not look up your public background in Cala.'})
                return self.json_response(200, {'facts': me_facts(rows), 'origin': 'cache' if cached else 'cala'})
            if path == '/api/dossier':
                name, fund = payload.get('name', ''), payload.get('fund', '')
                if (not isinstance(name, str) or not 1 <= len(name.strip()) <= 150
                        or not isinstance(fund, str) or not 1 <= len(fund.strip()) <= 120):
                    return self.json_response(400, {'error': 'A person and fund are required.'})
                name, fund = name.strip(), fund.strip()
                record = saved_dossier(name, fund)
                if record:
                    return self.json_response(200, {'name': record['name'], 'fund': record['fund'],
                                                    'facts': record['facts'], 'origin': 'saved'})
                facts, cached, failed = dossier_facts(name, fund)
                if len(failed) == len(DOSSIER_PARTS):
                    return self.json_response(502, {'error': 'Could not retrieve the dossier from Cala.'})
                return self.json_response(200, {'name': name, 'fund': fund, 'facts': facts,
                                                'origin': 'cache' if cached else 'cala', 'failed': failed})
            if path == '/api/rank':
                me = payload.get('me', {})
                targets = payload.get('targets', [])
                candidates = payload.get('candidates', [])
                def _row(entry, fields, size):
                    return (isinstance(entry, dict)
                            and all(isinstance(entry.get(f), str) and len(entry[f].strip()) <= size
                                    for f in fields))
                ok_me = _row(me, ('name',), 120) and isinstance(me.get('context', ''), str)
                ok_targets = (isinstance(targets, list) and len(targets) <= 10
                              and all(_row(t, ('name', 'org'), 120) for t in targets))
                ok_candidates = (isinstance(candidates, list) and 1 <= len(candidates) <= 30
                                 and all(_row(c, ('id', 'label'), 120)
                                         and c.get('kind') in ('person', 'org')
                                         and isinstance(c.get('sublabel', ''), str)
                                         and isinstance(c.get('links', []), list)
                                         and len(c.get('links', [])) <= 8
                                         and all(isinstance(k, str) and len(k) <= 80
                                                 for k in c.get('links', []))
                                         for c in candidates))
                if not (ok_me and ok_targets and ok_candidates):
                    return self.json_response(400, {'error': 'Invalid ranking request.'})
                me = {'name': clip(me['name'], 120), 'context': clip(me.get('context', ''), 300)}
                targets = [{'name': clip(t['name'], 120), 'org': clip(t['org'], 120)} for t in targets]
                candidates = [{'id': clip(c['id'], 80), 'label': clip(c['label'], 120),
                               'kind': c['kind'], 'sublabel': clip(c.get('sublabel', ''), 160),
                               'links': [clip(k, 80) for k in c.get('links', [])[:8]]}
                              for c in candidates]
                fingerprint = cache_fingerprint(me, targets, candidates)

                def rank():
                    try:
                        key = read_key(ROOT / '.env', 'OPENAI_API_KEY')
                    except ValueError:
                        return []
                    with openai_slots:
                        order = rank_candidates(me['name'], me['context'], targets, candidates, key)
                    return order if isinstance(order, list) else []
                order, hit = cached_entity(f'openai|rank|v2|{fingerprint}', rank)
                return self.json_response(200, {'order': order or [], 'origin': 'cache' if hit else 'openai'})

            if path == '/api/network':
                kind = payload.get('kind')
                name = payload.get('name')
                context = payload.get('context', '')
                background = payload.get('background', True)
                deep = payload.get('deep', False)
                enhance = payload.get('enhance', False)
                include_adjacent = payload.get('include_adjacent', False)
                known = payload.get('known', [])
                focus = payload.get('focus', [])
                focus_people = payload.get('focus_people', [])
                identity_orgs = payload.get('identity_orgs', [])
                profile_url = payload.get('profile_url', '')
                counterpart = payload.get('counterpart') or {}
                def valid_list(value, limit):
                    return (isinstance(value, list) and len(value) <= limit
                            and all(isinstance(item, str) and 1 <= len(item.strip()) <= 120 for item in value))
                if (kind not in ('person', 'org')
                        or not isinstance(name, str) or not 1 <= len(name.strip()) <= 150
                        or not isinstance(context, str) or len(context) > 300
                        or not isinstance(background, bool)
                        or not isinstance(deep, bool)
                        or not isinstance(enhance, bool)
                        or not isinstance(include_adjacent, bool)
                        or not valid_list(known, 30)
                        or not valid_list(focus, 15)
                        or not valid_list(focus_people, 12)
                        or not valid_list(identity_orgs, 10)
                        or not isinstance(profile_url, str) or len(profile_url) > 300
                        or (profile_url and not linkedin_person_url(profile_url))
                        or not isinstance(counterpart, dict)
                        or not isinstance(counterpart.get('name', ''), str)
                        or len(counterpart.get('name', '')) > 150
                        or not isinstance(counterpart.get('context', ''), str)
                        or len(counterpart.get('context', '')) > 300):
                    return self.json_response(400, {'error': 'A person or organization name is required.'})
                name = clip(name)
                context = clip(context, 300)
                counterpart = {'name': clip(counterpart.get('name'), 150),
                               'context': clip(counterpart.get('context'), 300)}
                identity_orgs = [clip(k, 120) for k in identity_orgs]
                subject = subject_text(name, context)
                if profile_url:
                    subject += f'. Their LinkedIn profile is {profile_url}'
                focus = [clip(k, 120) for k in focus if k.casefold() != name.casefold()][:15]
                focus_people = [clip(k, 120) for k in focus_people if k.casefold() != name.casefold()]
                fingerprint = cache_fingerprint(kind, name.casefold(), context.casefold(), profile_url,
                                                identity_orgs, focus, focus_people, counterpart)
                relevant = lambda row: bridge_relevant(row, focus, counterpart, focus_people)
                if kind == 'org':
                    org_key = f'net|org|v2|{fingerprint}'

                    def org_graph():
                        entity, resolve_hit = resolve_entity(name, False, context)
                        if not entity:
                            return entity, [], resolve_hit
                        graph, graph_hit = entity_graph(entity['id'])
                        return entity, graph_org_people(graph, context.casefold()), resolve_hit and graph_hit
                    with ThreadPoolExecutor(max_workers=2) as pool:
                        graph_future = pool.submit(org_graph)
                        ok, rows, hit = cached_rows(org_key, org_people_prompt(
                            subject, focus, counterpart, focus_people), network_slots)
                        entity, graph_people, graph_hit = graph_future.result()
                    scoped = bool(focus or focus_people or counterpart.get('name'))
                    graph_people = [p for p in graph_people if not scoped or relevant(p)]
                    cala_people = [p for p in org_people_rows(rows if ok else []) if not scoped or relevant(p)]
                    people = merge_search_rows([with_origin(graph_people, 'cala-graph'),
                                                with_origin(cala_people, 'cala')],
                                               ('name', 'relationship', 'affiliation'))
                    origin = 'cala' if ok and not hit else ('cache' if graph_hit else 'graph') if graph_people else 'cache'
                    openai_rows = None
                    if deep or enhance or not ok or not people:
                        openai_rows = openai_search(f'openai|v2|org|{fingerprint}', subject, 'org',
                                                    focus, counterpart, focus_people)
                        ai_people = [p for p in org_people_rows(openai_rows or []) if not scoped or relevant(p)]
                        if ai_people:
                            people = merge_search_rows([people, with_origin(ai_people, 'openai')],
                                                       ('name', 'relationship', 'affiliation'))
                            origin = 'openai'
                    if not ok and not graph_people and openai_rows is None:
                        return self.json_response(502, {'error': 'Cala and web research are unavailable.'})
                    return self.json_response(200, {'kind': 'org', 'name': name, 'entity': entity,
                                                    'people': people, 'origin': origin,
                                                    'failed': [] if ok else ['cala']})

                if not identity_orgs and not profile_url:
                    return self.json_response(200, {'kind': 'person', 'name': name, 'entity': None,
                                                    'connections': [], 'facts': [], 'origin': 'cala',
                                                    'failed': ['identity']})

                def person_graph():
                    entity, resolve_hit = resolve_entity(name, True, context, identity_orgs, profile_url)
                    if not entity:
                        return entity, [], [], resolve_hit
                    graph, graph_hit = entity_graph(entity['id'])
                    if not entity_matches_identity(entity, graph, identity_orgs, profile_url):
                        return None, [], [], graph_hit
                    return entity, graph_person_connections(graph, name), \
                        (graph_person_facts(graph) if background or deep or enhance else []), \
                        resolve_hit and graph_hit

                adjacent_suffix = '|adjacent' if include_adjacent else ''
                queries = [('connections', f'net|v2|connections|{fingerprint}{adjacent_suffix}',
                            connections_prompt(subject, focus, counterpart, focus_people, include_adjacent))]
                if background or deep or enhance:
                    queries.append(('background', f'net|v2|background|{fingerprint}', background_prompt(subject)))
                with ThreadPoolExecutor(max_workers=3) as pool:
                    graph_future = pool.submit(person_graph)
                    results = list(pool.map(lambda q: (q[0], cached_rows(q[1], q[2], network_slots)), queries))
                    entity, graph_connections, graph_facts, graph_hit = graph_future.result()
                failed = [label for label, (ok, _, _) in results if not ok]
                found = {label: rows for label, (ok, rows, _) in results if ok}
                scoped = bool(focus or focus_people or counterpart.get('name'))
                cala_rows = connection_rows(found.get('connections', []), name)
                adjacent_groups = []
                if scoped and include_adjacent:
                    adjacent_groups = [
                        with_origin(adjacent_connections(graph_connections, relevant), 'cala-graph'),
                        with_origin(adjacent_connections(cala_rows, relevant), 'cala'),
                    ]
                graph_connections = [c for c in graph_connections if not scoped or relevant(c)]
                cala_connections = [c for c in cala_rows if not scoped or relevant(c)]
                connections = merge_search_rows([with_origin(graph_connections, 'cala-graph'),
                                                 with_origin(cala_connections, 'cala')],
                                                ('name', 'relationship', 'via', 'organization'))
                facts = merge_search_rows([with_origin(graph_facts, 'cala-graph'),
                                           with_origin(me_facts(found.get('background', [])), 'cala')],
                                          ('kind', 'organization', 'role', 'start'), 18)
                used_graph = bool(graph_connections or graph_facts)
                origin = 'cala' if any(not hit for _, (_, _, hit) in results) \
                    else ('cache' if graph_hit else 'graph') if used_graph else 'cache'
                search_connections = deep or enhance or bool(failed) or not connections
                search_background = deep or enhance or (background and len(facts) < 3) or bool(failed)
                ai_results = {}
                with ThreadPoolExecutor(max_workers=2) as pool:
                    futures = {}
                    if search_connections:
                        args = (f'openai|v2|person|{fingerprint}{adjacent_suffix}', subject, 'person',
                                focus, counterpart, focus_people)
                        futures['connections'] = pool.submit(openai_search, *args, True) if include_adjacent \
                            else pool.submit(openai_search, *args)
                    if search_background:
                        futures['background'] = pool.submit(openai_search, f'openai|v2|background|{fingerprint}',
                                                            subject, 'background', focus, counterpart, focus_people)
                    ai_results = {label: future.result() for label, future in futures.items()}
                if isinstance(ai_results.get('connections'), list):
                    ai_rows = connection_rows(ai_results['connections'], name)
                    if scoped and include_adjacent:
                        adjacent_groups.append(with_origin(adjacent_connections(ai_rows, relevant), 'openai'))
                    ai_connections = [c for c in ai_rows if not scoped or relevant(c)]
                    if ai_connections:
                        connections = merge_search_rows([connections, with_origin(ai_connections, 'openai')],
                                                        ('name', 'relationship', 'via', 'organization'))
                        origin = 'openai'
                if adjacent_groups:
                    adjacent = merge_search_rows(adjacent_groups,
                                                 ('name', 'relationship', 'via', 'organization'), 2)
                    connections = merge_search_rows([connections, adjacent],
                                                    ('name', 'relationship', 'via', 'organization'))
                    if any(row.get('origin') == 'openai' for row in adjacent):
                        origin = 'openai'
                if isinstance(ai_results.get('background'), list):
                    ai_facts = me_facts(ai_results['background'])
                    if ai_facts:
                        facts = merge_search_rows([facts, with_origin(ai_facts, 'openai')],
                                                  ('kind', 'organization', 'role', 'start'), 18)
                        origin = 'openai'
                if (len(failed) == len(results) and not graph_connections and not graph_facts
                        and not any(isinstance(value, list) for value in ai_results.values())):
                    return self.json_response(502, {'error': 'Cala and web research are unavailable.'})
                failed.extend('web-' + label for label, rows in ai_results.items() if rows is None)
                return self.json_response(200, {'kind': 'person', 'name': name, 'entity': entity,
                                                'connections': connections, 'facts': facts,
                                                'origin': origin, 'failed': failed})
            name = str(payload.get('name', '')).strip()
            context = payload.get('context', '')
            if not isinstance(context, str) or len(context) > 1000:
                return self.json_response(400, {'error': 'Invalid company description.'})
            if not name or len(name) > 100:
                return self.json_response(400, {'error': 'Enter a startup name (up to 100 characters).'})
            summary = json.loads((ROOT / 'research/results-summary.json').read_text())
            rows = [r for r in summary['round_records'] if r.get('company', '').casefold() == name.casefold()]
            if rows:
                return self.json_response(200, {'company': rows[0]['company'], 'rounds': rows, 'cached': True})
            prompt = (f'List publicly announced funding rounds for the startup {name}, in chronological order. '
                      'One row per round. Return company, round_type, announcement_date, lead_investors, '
                      'investors and source_urls. Do not invent missing facts; use null when unknown.')
            if context.strip():
                prompt += (' The intended company is described here: ' + context.strip() +
                           '. Include only rounds of this exact company. Exclude different companies with the same or similar name. '
                           'If the identity or funding is uncertain, return no rows.')
            result = call_json('knowledge/query', read_key(ROOT / '.env'), {'input': prompt, 'return_entities': True}, 90)
            if not result['ok'] or answer_state(result.get('data')) != 'data_returned':
                return self.json_response(502, {'error': 'Cala returned an incomplete response. Try a more specific name.'})
            rows = result['data'].get('results', [])
            rows = [r for r in rows if isinstance(r, dict) and r.get('round_type') and r.get('announcement_date')]
            return self.json_response(200, {'company': name, 'rounds': rows, 'cached': False})
        except (ValueError, json.JSONDecodeError):
            return self.json_response(400, {'error': 'Invalid request.'})
        except Exception:
            traceback.print_exc()
            return self.json_response(500, {'error': 'Could not retrieve data. Check your connection and Cala key.'})

if __name__ == '__main__':
    if not (DIST / 'index.html').exists():
        print('Frontend build not found. Run: cd web && npm install && npm run build')
    server = ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
    print('VCScout: http://127.0.0.1:8765', flush=True)
    server.serve_forever()
