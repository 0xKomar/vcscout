"""Hosting checks using temporary assets and no paid API calls."""
import base64
import http.client
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app


class HostingTests(unittest.TestCase):
    def setUp(self):
        self.assets = tempfile.TemporaryDirectory()
        self.dist = Path(self.assets.name)
        (self.dist / 'index.html').write_text('<!doctype html><title>VCScout</title>')
        self.patches = [patch.object(app, 'DIST', self.dist),
                        patch.dict('os.environ', {'VCSCOUT_ACCESS_PASSWORD': 'test-only-password'}),
                        patch.object(app, 'call_json', side_effect=AssertionError('No live API calls in tests'))]
        for item in self.patches:
            item.start()
        self.server = app.ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        for item in reversed(self.patches):
            item.stop()
        self.assets.cleanup()

    def request(self, method, path, payload=None, password=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        headers = {}
        if password is not None:
            headers['Authorization'] = 'Basic ' + base64.b64encode(('vcscout:' + password).encode()).decode()
        body = json.dumps(payload) if payload is not None else None
        if body is not None:
            headers['Content-Type'] = 'application/json'
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return result

    def test_health_check_does_not_require_password(self):
        status, _, body = self.request('GET', '/healthz')
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {'status': 'ok'})

    def test_missing_frontend_fails_readiness(self):
        (self.dist / 'index.html').unlink()
        self.assertEqual(self.request('GET', '/healthz')[0], 503)

    def test_page_and_paid_api_are_protected(self):
        self.assertEqual(self.request('GET', '/')[0], 401)
        self.assertEqual(self.request('POST', '/api/similar', {'idea': 'AI hiring assistant'})[0], 401)
        self.assertEqual(self.request('GET', '/', password='wrong')[0], 401)

    def test_authenticated_page_and_saved_api(self):
        self.assertEqual(self.request('GET', '/', password='test-only-password')[0], 200)
        status, _, body = self.request('POST', '/api/partners',
                                       {'company': 'Attio', 'fund': 'Point Nine'},
                                       password='test-only-password')
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)['origin'], 'saved')


if __name__ == '__main__':
    unittest.main()
