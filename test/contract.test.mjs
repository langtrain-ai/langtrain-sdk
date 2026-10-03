// The built SDK must only call routes the Langtrain API server has, with X-API-Key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startFakeApi, API_KEY } from './fake-api.mjs';

const require = createRequire(import.meta.url);
const { TrainingClient } = require('../dist/index.js');

test('training jobs, with a bare host or the /api/v1 prefix as baseUrl', async () => {
  const api = await startFakeApi();
  try {
    for (const baseUrl of [api.url, `${api.url}/api/v1`]) {
      const training = new TrainingClient({ apiKey: API_KEY, baseUrl, maxRetries: 0 });
      const job = await training.createJob({ base_model: 'm', dataset_id: 'ds-1', training_method: 'qlora' });
      assert.equal(job.id, 'job-1');
      assert.equal((await training.getJob('job-1')).status, 'completed');
      const points = [];
      for await (const p of training.streamTelemetry('job-1', 0)) points.push(p);
      assert.equal(points[0].step, 10);
      assert.equal((await training.waitForJob('job-1', 0)).status, 'completed');
      await training.cancelJob('job-1');
    }
    assert.deepEqual(api.unknown, [], `called routes the server doesn't have: ${api.unknown}`);
    assert.ok(api.calls.every((c) => c.key === API_KEY));
  } finally {
    await api.close();
  }
});

test('a bad key surfaces as an error, not a hang', async () => {
  const api = await startFakeApi();
  try {
    const training = new TrainingClient({ apiKey: 'sk-lt-wrong', baseUrl: api.url, maxRetries: 0 });
    await assert.rejects(training.getJob('job-1'));
  } finally {
    await api.close();
  }
});
