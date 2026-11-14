#!/usr/bin/env python3
"""Local VCScout preview. The Cala and OpenAI keys stay on the server."""
import json
import os
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
DIST = ROOT / 'web' / 'dist'
sys.path.insert(0, str(ROOT / 'tools'))
from cala_http import call_json
from probe_cala import read_key, answer_state
from linkedin_lookup import fetch_photo, find_profile

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
        if path not in ('/api/search', '/api/partners', '/api/similar', '/api/risks', '/api/fund-paths', '/api/person-investments', '/api/linkedin', '/api/founders'):
            return self.json_response(404, {'error': 'Endpoint not found.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length > 4096:
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
            return self.json_response(500, {'error': 'Could not retrieve data. Check your connection and Cala key.'})

if __name__ == '__main__':
    if not (DIST / 'index.html').exists():
        print('Frontend build not found. Run: cd web && npm install && npm run build')
    server = ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
    print('VCScout: http://127.0.0.1:8765', flush=True)
    server.serve_forever()
