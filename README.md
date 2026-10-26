# Taskflow

A responsive, English-language to-do application built with Node.js 22 and vanilla JavaScript. No dependencies or installation required.

## Run

```sh
cd taskflow
npm start
```

Open http://localhost:3000. Use `npm run dev` for automatic server restarts or `npm test` to run the integration tests. Set the `PORT` environment variable to use another port.

## Features

- Create, edit, complete, reopen, and delete tasks with a confirmation dialog
- Notes, due dates, three priority levels, and Personal / Work / Learning projects
- Today, upcoming, completed, and project views
- Search, priority filtering, and sorting
- Live completion statistics, overdue indicators, and accessible dialogs
- Responsive layout and persistent server storage
- Validated API requests, bounded request sizes, safe text rendering, and security headers

## Storage and scope

Tasks are saved automatically to `data/tasks.json`. Writes are serialized and use a temporary file plus rename to prevent partially written files. Back up this file to retain your tasks. Run only one server process per data file.

This is a single-user local application. It listens on 127.0.0.1 by default and does not include accounts or authentication. Add authentication and a database before deploying for multiple users.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create a task |
| PATCH | `/api/tasks/:id` | Update fields or completion |
| DELETE | `/api/tasks/:id` | Delete a task |

Task fields: `title` (required, up to 200 characters), `notes` (up to 2,000 characters), `project` (Personal/Work/Learning), `priority` (low/medium/high), `dueDate` (YYYY-MM-DD or empty), and `completed` (boolean).
