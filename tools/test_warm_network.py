"""Regression tests for warm-intro identity, evidence and provider fallback."""
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib.request import Request, urlopen

import app
from openai_graph import cited_rows


def edge(name, entity_type='Company', role=''):
    return {
        'name': name,
        'entity_type': entity_type,
        'properties': {'role': role, 'sources': [{'document': 'https://example.com/evidence'}]},
    }


class IdentityAndEvidenceTests(unittest.TestCase):
    def test_entity_cache_distinguishes_context_for_same_name(self):
        cache = {}
        candidates = [
            {'id': 'minerva', 'name': 'Jan Kowalski', 'entity_type': 'Person', 'description': 'Engineer at Minerva'},
            {'id': 'acme', 'name': 'Jan Kowalski', 'entity_type': 'Person', 'description': 'Engineer at Acme'},
        ]

        def cached(key, compute):
            if key in cache:
                return cache[key], True
            cache[key] = compute()
            return cache[key], False

        with patch.object(app, 'cached_entity', side_effect=cached), \
                patch.object(app, 'cala_entity', return_value={'ok': True, 'data': {'entities': candidates}}):
            first, _ = app.resolve_entity('Jan Kowalski', True, 'engineer at Minerva', ['Minerva'])
            second, _ = app.resolve_entity('Jan Kowalski', True, 'engineer at Acme', ['Acme'])
        self.assertEqual((first['id'], second['id']), ('minerva', 'acme'))

    def test_person_graph_requires_identity_anchor(self):
        entity = {'name': 'Jan Kowalski', 'description': ''}
        graph = {'relationships': {'outgoing': {'WORKS_AT': [edge('Minerva')]}}}
        self.assertTrue(app.entity_matches_identity(entity, graph, ['Minerva'], ''))
        self.assertFalse(app.entity_matches_identity(entity, graph, ['Acme'], ''))
        self.assertFalse(app.entity_matches_identity(entity, graph, [], ''))

    def test_graph_relationships_do_not_invent_jobs_or_education(self):
        graph = {'relationships': {'outgoing': {
            'IS_ADVISOR_OF': [edge('Acme', role='Advisor')],
            'INVESTED_IN': [edge('Beta')],
            'ATTENDED': [edge('Hackathon', 'Event')],
        }}}
        facts = app.graph_person_facts(graph)
        self.assertEqual([(f['kind'], f['organization']) for f in facts], [('advisor', 'Acme')])
        org_graph = {'relationships': {
            'incoming': {'ATTENDED': [edge('Anna Nowak', 'Person')]},
            'outgoing': {'WORKS_AT': [edge('Jan Kowalski', 'Person')]},
        }}
        people = app.graph_org_people(org_graph, 'an event or program')
        self.assertEqual([(p['name'], p['relationship']) for p in people], [('Anna Nowak', 'participant')])

    def test_ai_rows_require_real_web_search_citations(self):
        response = {'output': [
            {'type': 'web_search_call', 'action': {'sources': [{'url': 'https://example.com/bio'}]}},
            {'type': 'message', 'content': [{'annotations': [
                {'type': 'url_citation', 'url': 'https://example.org/team'},
            ]}]},
        ]}
        rows = [
            {'source_url': 'https://example.com/bio?utm_source=test'},
            {'source_url': 'https://example.org/team'},
            {'source_url': 'https://invented.example/claim'},
        ]
        self.assertEqual(cited_rows(response, rows), rows[:2])
        self.assertEqual(cited_rows({'output': []}, rows), [])

    def test_duplicate_cala_and_ai_evidence_is_preserved(self):
        graph = {'name': 'Anna Nowak', 'relationship': 'colleague',
                 'source_url': 'https://example.com/a', 'origin': 'cala-graph'}
        web = {'name': 'Anna Nowak', 'relationship': 'colleague',
               'source_url': 'https://example.com/b', 'origin': 'openai'}
        merged = app.merge_search_rows([[graph], [web]], ('name', 'relationship'))
        self.assertEqual(len(merged), 1)
        self.assertEqual({s['origin'] for s in merged[0]['sources']}, {'cala-graph', 'openai'})
        merged_again = app.merge_search_rows([merged], ('name', 'relationship'))
        self.assertEqual({s['origin'] for s in merged_again[0]['sources']}, {'cala-graph', 'openai'})


class NetworkFallbackTests(unittest.TestCase):
    def test_cala_failure_falls_back_to_web_and_filters_unrelated_people(self):
        def web(_key, _subject, kind, _focus, _counterpart, _people):
            if kind == 'background':
                return [{'category': 'role', 'organization': 'ZdajTo', 'role': 'Engineer',
                         'source_url': 'https://example.com/profile'}]
            return [
                {'connected_person': 'Anna Nowak', 'connected_person_organization': 'Minerva',
                 'organization': 'ZdajTo', 'relationship': 'colleague',
                 'source_url': 'https://example.com/team'},
                {'connected_person': 'Random Person', 'connected_person_organization': 'Unrelated',
                 'organization': 'Elsewhere', 'relationship': 'colleague',
                 'source_url': 'https://example.com/random'},
            ]

        with patch.object(app, 'cached_rows', return_value=(False, [], False)), \
                patch.object(app, 'resolve_entity', return_value=(None, False)), \
                patch.object(app, 'openai_search', side_effect=web):
            server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                payload = {'kind': 'person', 'name': 'Igor Komar', 'context': 'at ZdajTo',
                           'identity_orgs': ['ZdajTo'], 'background': True, 'enhance': True,
                           'focus': ['Minerva'], 'counterpart': {'name': 'Wiktor Gawel', 'context': 'Minerva'}}
                request = Request(f'http://127.0.0.1:{server.server_port}/api/network',
                                  data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
                with urlopen(request, timeout=5) as response:
                    data = json.load(response)
                self.assertEqual([c['name'] for c in data['connections']], ['Anna Nowak'])
                self.assertEqual(data['connections'][0]['origin'], 'openai')
                self.assertEqual(data['connections'][0]['certainty'], 'inferred')
                self.assertEqual(data['facts'][0]['organization'], 'ZdajTo')
                self.assertIn('connections', data['failed'])
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)

    def test_selected_contact_can_return_two_sourced_adjacent_people(self):
        def web(_key, _subject, kind, _focus, _counterpart, _people, include_adjacent=False):
            if kind == 'background':
                return []
            self.assertTrue(include_adjacent)
            return [
                {'connected_person': 'Anna Nowak', 'connected_person_organization': 'Minerva',
                 'organization': 'ZdajTo', 'relationship': 'colleague',
                 'source_url': 'https://example.com/direct'},
                {'connected_person': 'Alicja Nowak', 'connected_person_organization': 'Elsewhere',
                 'organization': 'ZdajTo', 'relationship': 'colleague',
                 'source_url': 'https://example.com/colleague'},
                {'connected_person': 'Jan Nowak', 'connected_person_organization': 'Unknown',
                 'organization': 'Conference', 'relationship': 'co-appearance',
                 'source_url': 'https://example.com/event'},
                {'connected_person': 'Paul Novak', 'connected_person_organization': 'Unknown',
                 'organization': 'Conference', 'relationship': 'classmate',
                 'source_url': 'https://example.com/classmate'},
                {'connected_person': 'Uncited Person', 'relationship': 'colleague'},
                {'connected_person': 'Generic Person', 'relationship': 'other',
                 'source_url': 'https://example.com/other'},
            ]

        with patch.object(app, 'cached_rows', return_value=(False, [], False)), \
                patch.object(app, 'resolve_entity', return_value=(None, False)), \
                patch.object(app, 'openai_search', side_effect=web):
            server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                payload = {
                    'kind': 'person', 'name': 'Igor Komar', 'context': 'at ZdajTo',
                    'identity_orgs': ['ZdajTo'], 'enhance': True, 'include_adjacent': True,
                    'focus': ['Minerva'], 'counterpart': {'name': 'Wiktor Gawel', 'context': 'Minerva'},
                }
                request = Request(f'http://127.0.0.1:{server.server_port}/api/network',
                                  data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
                with urlopen(request, timeout=5) as response:
                    data = json.load(response)
                self.assertEqual([row['name'] for row in data['connections']],
                                 ['Anna Nowak', 'Alicja Nowak', 'Jan Nowak'])
                self.assertEqual(data['connections'][-1]['relationship'], 'co-appearance')
                self.assertTrue(all(row['certainty'] == 'inferred' for row in data['connections']))
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)


if __name__ == '__main__':
    unittest.main()
