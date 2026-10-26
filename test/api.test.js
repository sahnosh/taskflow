import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.js';

test('task lifecycle, validation, concurrent writes, and persistence', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'taskflow-'));
  const dataFile = path.join(directory, 'tasks.json');
  let server;
  const start = async () => { server = await createApp({ dataFile }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); return `http://127.0.0.1:${server.address().port}`; };
  const close = () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
  try {
    let base = await start();
    const request = (suffix = '', method = 'GET', body) => fetch(`${base}/api/tasks${suffix}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    assert.deepEqual(await (await request()).json(), []);
    assert.equal((await request('', 'POST', { title: ' ' })).status, 400);
    assert.equal((await request('', 'POST', { title: 'Bad date', dueDate: '2026-02-30' })).status, 400);
    const created = await request('', 'POST', { title: 'Ship project', priority: 'high', project: 'Work' });
    assert.equal(created.status, 201);
    const task = await created.json();
    assert.equal(task.completed, false);
    const updated = await (await request(`/${task.id}`, 'PATCH', { completed: true, notes: 'Done!' })).json();
    assert.equal(updated.completed, true);
    const parallel = await Promise.all(Array.from({ length: 6 }, (_, i) => request('', 'POST', { title: `Task ${i}` })));
    assert.ok(parallel.every(response => response.status === 201));
    await close(); base = await start();
    const persisted = await (await request()).json();
    assert.equal(persisted.length, 7);
    assert.equal(persisted.find(item => item.id === task.id).notes, 'Done!');
    assert.equal((await request(`/${task.id}`, 'DELETE')).status, 200);
    assert.equal((await request(`/${task.id}`, 'PATCH', { title: 'Missing' })).status, 404);
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.match(await home.text(), /Taskflow/);
    assert.equal((await fetch(`${base}/data/tasks.json`)).status, 404);
  } finally { if (server?.listening) await close(); await rm(directory, { recursive: true, force: true }); }
});
