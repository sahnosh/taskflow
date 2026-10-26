const $ = selector => document.querySelector(selector);
let tasks = [], view = 'all', status = 'all', editing = null, deleting = null;
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const escape = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
async function api(url = '', method = 'GET', body) {
  const response = await fetch(`/api/tasks${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}
let toastTimer;
function notify(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 4000); }
function render() {
  const done = tasks.filter(task => task.completed).length;
  $('#total').textContent = tasks.length; $('#pending').textContent = tasks.length - done; $('#done').textContent = done;
  $('#allCount').textContent = tasks.length; $('#todayCount').textContent = tasks.filter(task => task.dueDate === today() && !task.completed).length;
  $('#progressCaption').textContent = tasks.length ? `${Math.round(done / tasks.length * 100)}% of your tasks complete` : 'Your next win is waiting';
  const search = $('#search').value.toLowerCase().trim();
  const scoped = tasks.filter(task => view === 'all' || (view === 'today' && task.dueDate === today()) || (view === 'upcoming' && task.dueDate > today() && !task.completed) || (view === 'completed' && task.completed) || task.project === view);
  $('#visibleCount').textContent = scoped.length;
  const filtered = scoped.filter(task => (status === 'all' || task.completed === (status === 'completed')) && ($('#priorityFilter').value === 'all' || task.priority === $('#priorityFilter').value) && `${task.title} ${task.notes}`.toLowerCase().includes(search));
  const priorities = { high: 0, medium: 1, low: 2 };
  filtered.sort((a, b) => $('#sort').value === 'priority' ? priorities[a.priority] - priorities[b.priority] : $('#sort').value === 'due' ? (a.dueDate || '9999').localeCompare(b.dueDate || '9999') : b.createdAt.localeCompare(a.createdAt));
  $('#resultCount').textContent = `${filtered.length} task${filtered.length === 1 ? '' : 's'}`;
  $('#taskList').innerHTML = filtered.length ? filtered.map(task => {
    const date = task.dueDate ? new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date';
    return `<article class="task-row ${task.completed ? 'is-complete' : ''}" data-id="${task.id}"><input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''} aria-label="Mark ${escape(task.title)} as ${task.completed ? 'active' : 'complete'}"><div class="task-copy"><button class="task-title" data-action="edit">${escape(task.title)}</button>${task.notes ? `<p>${escape(task.notes)}</p>` : ''}<div class="task-meta"><span class="project-tag"><i class="dot ${ { Personal: 'purple', Work: 'orange', Learning: 'blue' }[task.project]}"></i>${task.project}</span><span class="due ${task.dueDate && task.dueDate < today() && !task.completed ? 'overdue' : ''}">◷ ${date}${task.dueDate && task.dueDate < today() && !task.completed ? ' · Overdue' : ''}</span></div></div><span class="priority ${task.priority}"><i></i>${task.priority}</span><button class="row-action" data-action="edit" aria-label="Edit ${escape(task.title)}" title="Edit task">✎</button><button class="row-action delete" data-action="delete" aria-label="Delete ${escape(task.title)}" title="Delete task">×</button></article>`;
  }).join('') : `<div class="empty"><div class="empty-icon">✓</div><h2>${tasks.length ? 'A little breathing room.' : 'Good things start with a first task.'}</h2><p>${tasks.length ? 'No tasks match this view. Try another filter or add something new.' : 'Get your ideas out of your head and into your workspace.'}</p><button class="secondary" id="emptyAdd">＋ Create a task</button></div>`;
  $('#emptyAdd')?.addEventListener('click', () => openForm());
}
function openForm(task = null) {
  editing = task?.id || null;
  $('#taskForm').reset(); $('#formError').textContent = '';
  if (task) for (const field of ['title', 'notes', 'project', 'priority', 'dueDate']) $('#taskForm').elements[field].value = task[field];
  else if (['Work', 'Learning', 'Personal'].includes(view)) $('#taskForm').elements.project.value = view;
  $('#dialogTitle').textContent = task ? 'Edit task' : 'New task'; $('#saveTask').textContent = task ? 'Save changes' : 'Create task';
  $('#taskDialog').showModal(); $('#taskForm').elements.title.focus();
}
$('#currentDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
$('#addTask').addEventListener('click', () => openForm());
for (const id of ['closeDialog', 'cancelDialog']) $(`#${id}`).addEventListener('click', () => $('#taskDialog').close());
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  view = button.dataset.view; status = 'all';
  document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item === button));
  document.querySelectorAll('[data-status]').forEach(item => item.classList.toggle('selected', item.dataset.status === 'all'));
  $('#pageTitle').textContent = button.textContent.replace(/\d+/g, '').replace(/[▦☀▤✓]/g, '').trim() + '.';
  $('#breadcrumb').textContent = $('#pageTitle').textContent.slice(0, -1); render();
}));
document.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => { status = button.dataset.status; document.querySelectorAll('[data-status]').forEach(item => item.classList.toggle('selected', item === button)); render(); }));
for (const id of ['search', 'priorityFilter', 'sort']) $(`#${id}`).addEventListener('input', render);
$('#taskForm').addEventListener('submit', async event => {
  event.preventDefault(); $('#saveTask').disabled = true; $('#formError').textContent = '';
  try {
    const task = await api(editing ? `/${editing}` : '', editing ? 'PATCH' : 'POST', Object.fromEntries(new FormData(event.target)));
    if (editing) tasks = tasks.map(item => item.id === editing ? task : item); else tasks.unshift(task);
    $('#taskDialog').close(); render(); notify(editing ? 'Task updated.' : 'Your next step is ready. Task created.');
  } catch (error) { $('#formError').textContent = error.message; } finally { $('#saveTask').disabled = false; }
});
$('#taskList').addEventListener('change', async event => {
  if (!event.target.matches('.task-check')) return;
  const id = event.target.closest('[data-id]').dataset.id;
  event.target.disabled = true;
  try { const task = await api(`/${id}`, 'PATCH', { completed: event.target.checked }); tasks = tasks.map(item => item.id === id ? task : item); render(); notify(task.completed ? 'Nice work! Task completed.' : 'Task moved back to active.'); }
  catch (error) { event.target.checked = !event.target.checked; event.target.disabled = false; notify(error.message); }
});
$('#taskList').addEventListener('click', event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const task = tasks.find(item => item.id === button.closest('[data-id]').dataset.id);
  if (button.dataset.action === 'edit') openForm(task); else { deleting = task.id; $('#deleteDialog').showModal(); }
});
$('#cancelDelete').addEventListener('click', () => $('#deleteDialog').close());
$('#confirmDelete').addEventListener('click', async () => {
  $('#confirmDelete').disabled = true;
  try { await api(`/${deleting}`, 'DELETE'); tasks = tasks.filter(task => task.id !== deleting); $('#deleteDialog').close(); render(); notify('Task deleted.'); } catch (error) { notify(error.message); } finally { $('#confirmDelete').disabled = false; }
});
$('#taskList').innerHTML = '<div class="empty"><p>Loading your workspace...</p></div>';
api().then(result => { tasks = result; render(); }).catch(error => { $('#taskList').textContent = 'Unable to load tasks. Refresh the page to try again.'; notify(error.message); });
