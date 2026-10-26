import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function createApp({ dataFile = fileURLToPath(new URL('./data/tasks.json', import.meta.url)) } = {}) {
  await mkdir(path.dirname(dataFile), { recursive: true });
  let tasks;
  try { tasks = JSON.parse(await readFile(dataFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; tasks = []; }
  let queue = Promise.resolve();
  const save = async next => {
    await writeFile(`${dataFile}.tmp`, JSON.stringify(next, null, 2));
    await rename(`${dataFile}.tmp`, dataFile);
    tasks = next;
  };
  const root = fileURLToPath(new URL('./public/', import.meta.url));
  const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/tasks' && req.method === 'GET') return json(res, 200, tasks);
        const match = url.pathname.match(/^\/api\/tasks\/([a-f0-9-]+)$/);
        if (!(url.pathname === '/api/tasks' && req.method === 'POST') && !(match && ['PATCH', 'DELETE'].includes(req.method))) return json(res, 404, { error: 'Endpoint not found.' });
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16384) return json(res, 413, { error: 'Request is too large.' }); }
        let body = {};
        try { body = raw ? JSON.parse(raw) : {}; } catch { return json(res, 400, { error: 'Invalid JSON.' }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return json(res, 400, { error: 'Invalid task.' });
        const mutation = async () => {
          const index = match ? tasks.findIndex(task => task.id === match[1]) : -1;
          if (match && index < 0) return json(res, 404, { error: 'Task not found.' });
          if (req.method === 'DELETE') { await save(tasks.filter(task => task.id !== match[1])); return json(res, 200, { success: true }); }
          const old = index >= 0 ? tasks[index] : { id: randomUUID(), title: '', notes: '', project: 'Personal', priority: 'medium', dueDate: '', completed: false, createdAt: new Date().toISOString() };
          const task = { ...old };
          for (const key of ['title', 'notes', 'project', 'priority', 'dueDate', 'completed']) if (Object.hasOwn(body, key)) task[key] = body[key];
          if (typeof task.title !== 'string' || !task.title.trim() || task.title.length > 200 || typeof task.notes !== 'string' || task.notes.length > 2000 || !['Personal', 'Work', 'Learning'].includes(task.project) || !['low', 'medium', 'high'].includes(task.priority) || typeof task.completed !== 'boolean' || typeof task.dueDate !== 'string' || (task.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) || !Number.isFinite(Date.parse(task.dueDate)) || new Date(task.dueDate).toISOString().slice(0, 10) !== task.dueDate))) return json(res, 400, { error: 'Please check the task fields. A title is required (maximum 200 characters).' });
          task.title = task.title.trim();
          const next = [...tasks];
          if (index >= 0) next[index] = task; else next.unshift(task);
          await save(next);
          json(res, index >= 0 ? 200 : 201, task);
        };
        queue = queue.then(mutation, mutation);
        await queue;
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
      const files = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css' };
      const file = files[url.pathname];
      if (!file) { res.writeHead(404); return res.end('Not found'); }
      const content = await readFile(path.join(root, file));
      res.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }[path.extname(file)] });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) { console.error(error); if (!res.headersSent) json(res, 500, { error: 'Unable to save your changes. Please try again.' }); else res.end(); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createApp();
  server.listen(Number(process.env.PORT) || 3000, '127.0.0.1', () => console.log(`Taskflow is ready at http://localhost:${server.address().port}`));
}
