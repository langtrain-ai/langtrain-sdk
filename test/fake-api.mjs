// An in-process stand-in for the Langtrain API server with only the routes the
// real server serves to API keys (langtrain-server app/api/v1/finetune.py and
// friends). Any other path is recorded in `unknown` and returns 404.
// Keep in step with tests/fake_langtrain_api.py in the Python packages.
import http from 'node:http';

export const API_KEY = 'sk-lt-test';
const JOB = { id: 'job-1', name: 'run', status: 'completed', progress: 100, config: {}, metrics: { step: 10, loss: 0.5 }, created_at: '2026-10-03T00:00:00Z' };

export function startFakeApi() {
  const calls = [];
  const unknown = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const body = raw && (req.headers['content-type'] || '').includes('json') ? JSON.parse(raw) : null;
      calls.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body, key: req.headers['x-api-key'] });
      const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      const route = `${req.method} ${url.pathname}`;
      if (route === 'POST /api/v1/auth/api-keys/validate') {
        return url.searchParams.get('api_key') === API_KEY ? send(200, { valid: true, organization_id: 'org-1', plan: 'free' }) : send(401, { detail: 'Invalid API key' });
      }
      if (req.headers['x-api-key'] !== API_KEY) return send(401, { detail: 'Not authenticated' });
      switch (route) {
        case 'POST /api/v1/training/jobs': {
          const missing = ['base_model', 'dataset_id'].filter((k) => !(body && body[k]));
          return missing.length ? send(422, { detail: `missing ${missing}` }) : send(200, { ...JOB, status: 'pending', progress: 0 });
        }
        case 'GET /api/v1/training/jobs': return send(200, { data: [JOB], has_more: false });
        case 'GET /api/v1/training/jobs/job-1': return send(200, JOB);
        case 'POST /api/v1/training/jobs/job-1/cancel': return send(200, { ...JOB, status: 'cancelled' });
        case 'GET /api/v1/training/gpu-tiers': return send(200, { gpu_tiers: [{ id: 't4', label: 'T4 16GB', vram: 16, tflops: 65, price_hr: 0.35, recommended_for: 'Small models' }] });
        default:
          unknown.push(route);
          return send(404, { detail: 'Not Found' });
      }
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    resolve({ url: `http://127.0.0.1:${server.address().port}`, calls, unknown, close: () => new Promise((r) => server.close(r)) });
  }));
}
