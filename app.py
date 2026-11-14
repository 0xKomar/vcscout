#!/usr/bin/env python3
"""Local VCScout preview. The Cala key stays on the server."""
import json
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'tools'))
from cala_http import call_json
from probe_cala import read_key, answer_state

PARTNERS = {
    ('lovable', 'byfounders'): [{'name': 'Magnus Hambleton', 'role': 'Partner', 'connection': 'Autor opisu inwestycji w Lovable', 'source_url': 'https://www.byfounders.vc/insights/lovable-let-ai-help-you-make-your-minimum-lovable-product'}],
    ('attio', 'point nine'): [{'name': 'Ricardo Sequerra Amram', 'role': 'Partner', 'connection': 'Publicznie powiązany z inwestycją w Attio', 'source_url': 'https://attio.com/blog/attio-raises-33-million-in-funding'}],
    ('metaview', 'plural'): [{'name': 'Khaled Helioui', 'role': 'Partner', 'connection': 'Autor tekstu o inwestycji w Metaview', 'source_url': 'https://www.pluralplatform.com/features/why-we-invested-in-metaview'}, {'name': 'Pierre-Dimitri Gore-Coty', 'role': 'Partner', 'connection': 'Powiązany z Metaview w dokumentach SEC', 'source_url': 'https://www.sec.gov/Archives/edgar/data/1894764/000189476425000002/primary_doc.xml'}],
    ('metaview', 'vertex ventures us'): [{'name': 'Jonathan Heiliger', 'role': 'Inwestor', 'connection': 'Prowadził rundę seed Metaview', 'source_url': 'https://www.metaview.ai/resources/blog/weve-raised-a-6m-seed-to-power-people-decisions-with-truth'}],
    ('qdrant', 'spark capital'): [{'name': 'Yasmin Razavi', 'role': 'General Partner', 'connection': 'Cytowana przy Series A Qdrant', 'source_url': 'https://pulse2.com/qdrant-28-million-funding/'}],
}
partner_cache = {}
partner_slots = threading.BoundedSemaphore(2)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'web'), **kwargs)

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
        if path not in ('/api/search', '/api/partners', '/api/similar', '/api/risks'):
            return self.json_response(404, {'error': 'Nie znaleziono endpointu.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length > 4096:
                return self.json_response(413, {'error': 'Zapytanie jest zbyt długie.'})
            payload = json.loads(self.rfile.read(length))
            if path == '/api/risks':
                idea = payload.get('idea', '')
                funds = payload.get('funds', [])
                if not isinstance(idea, str) or not 15 <= len(idea.strip()) <= 2000 or not isinstance(funds, list) or len(funds) > 6 or any(not isinstance(f, str) or len(f) > 120 for f in funds):
                    return self.json_response(400, {'error': 'Nieprawidłowy opis startupu lub lista funduszy.'})
                if not funds:
                    return self.json_response(200, {'risks': []})
                prompt = ('For this startup idea, identify only documented potential direct portfolio conflicts among these funds: '
                          + ', '.join(funds) + '. Idea: ' + idea.strip() + '. '
                          'Return one JSON row per conflict with fields fund, competitor, reason, source_url. '
                          'A conflict requires a named portfolio company solving the same specific problem for similar customers, '
                          'and a direct public source showing the fund invested in that company. '
                          'Do not infer conflicts from general industry overlap, unknown portfolio, lack of investment, or co-investment. '
                          'Do not invent facts or URLs. If there is no supported example, return no rows.')
                result = call_json('knowledge/query', read_key(ROOT / '.env'), {'input': prompt, 'return_entities': True}, 90)
                if not result['ok'] or answer_state(result.get('data')) not in ('data_returned', 'empty'):
                    return self.json_response(502, {'error': 'Nie udało się sprawdzić konfliktów w Cala.'})
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
                    return self.json_response(400, {'error': 'Opisz pomysł w 15–2000 znakach.'})
                prompt = ("Find up to 4 real venture-backed startup companies with products, customers and business models similar to this startup idea. "
                          "For each, return one JSON row with fields company, description, similarity_reason, website, source_url. "
                          "Use names of existing companies, explain concrete similarity, and include a direct public source URL. "
                          "Do not fabricate companies, sources, investment outcomes or match percentages. "
                          "If no reliable match is known, return no rows. Startup idea: " + idea.strip())
                result = call_json('knowledge/query', read_key(ROOT / '.env'), {'input': prompt, 'return_entities': True}, 90)
                if not result['ok'] or answer_state(result.get('data')) not in ('data_returned', 'empty'):
                    return self.json_response(502, {'error': 'Cala nie zwróciła wyników. Spróbuj krócej opisać produkt i klientów.'})
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
                    return self.json_response(400, {'error': 'Brakuje nazwy funduszu lub startupu.'})
                identity = (company.casefold(), fund.casefold())
                for (known_company, known_fund), people in PARTNERS.items():
                    if identity[0] == known_company and (identity[1] == known_fund or identity[1].startswith(known_fund + ' ')):
                        return self.json_response(200, {'partners': people, 'origin': 'saved'})
                if identity in partner_cache:
                    return self.json_response(200, {'partners': partner_cache[identity], 'origin': 'cache'})
                prompt = (f'Identify up to 3 investment professionals at {fund} publicly linked to its investment in {company}. '
                          'Return one row per person with fields name, fund, role, connection, source_url. '
                          'Include a direct public source URL explicitly linking the person to this investment. '
                          'Do not guess people, roles, introductions or email addresses. If unknown return no rows.')
                with partner_slots:
                    result = call_json('knowledge/query', read_key(ROOT / '.env'), {'input': prompt, 'return_entities': True}, 90)
                if not result['ok']:
                    return self.json_response(502, {'error': 'Nie udało się pobrać kontaktów z Cala.'})
                data = result.get('data', {})
                if answer_state(data) == 'fallback':
                    return self.json_response(502, {'error': 'Cala nie potrafiła odpowiedzieć na to pytanie.'})
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
            name = str(payload.get('name', '')).strip()
            context = payload.get('context', '')
            if not isinstance(context, str) or len(context) > 1000:
                return self.json_response(400, {'error': 'Nieprawidłowy opis firmy.'})
            if not name or len(name) > 100:
                return self.json_response(400, {'error': 'Wpisz nazwę startupu (maksymalnie 100 znaków).'})
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
                return self.json_response(502, {'error': 'Cala nie zwróciła pełnej odpowiedzi. Spróbuj podać dokładniejszą nazwę.'})
            rows = result['data'].get('results', [])
            rows = [r for r in rows if isinstance(r, dict) and r.get('round_type') and r.get('announcement_date')]
            return self.json_response(200, {'company': name, 'rounds': rows, 'cached': False})
        except (ValueError, json.JSONDecodeError):
            return self.json_response(400, {'error': 'Nieprawidłowe zapytanie.'})
        except Exception:
            return self.json_response(500, {'error': 'Nie udało się pobrać danych. Sprawdź połączenie i klucz Cala.'})

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
    print('VCScout: http://127.0.0.1:8765', flush=True)
    server.serve_forever()
