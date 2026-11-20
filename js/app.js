/* =============================================
   TO-DO LIST LIFE DASHBOARD — app.js
   ============================================= */

'use strict';

/* ── Helpers ── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const storage = {
  get: function(k, fallback) {
    if (fallback === undefined) fallback = null;
    try {
      var v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fallback;
    } catch(e) {
      return fallback;
    }
  },
  set: function(k, v) {
    localStorage.setItem(k, JSON.stringify(v));
  }
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ── Toast ── */
var toastTimer;
function showToast(msg, type) {
  if (!type) type = 'success';
  var toast = $('#toast');
  toast.textContent = (type === 'success' ? '✅ ' : '⚠️ ') + msg;
  toast.className = 'toast ' + type + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() {
    toast.classList.remove('show');
  }, 2800);
}

/* ══════════════════════════════════════════════
   1. CLOCK & GREETING
══════════════════════════════════════════════ */
var clockEl     = $('#clock');
var greetEl     = $('#greeting-text');
var dateEl      = $('#greeting-date');
var nameInput   = $('#name-input');
var saveNameBtn = $('#save-name-btn');

function getGreetingWord() {
  var h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Selamat Pagi \uD83C\uDF38';
  if (h >= 12 && h < 15) return 'Selamat Siang \uD83C\uDF3C';
  if (h >= 15 && h < 19) return 'Selamat Sore \uD83C\uDF3A';
  return 'Selamat Malam \uD83C\uDF19';
}

function updateClock() {
  var now  = new Date();
  var name = storage.get('userName', '');

  var hh = String(now.getHours()).padStart(2, '0');
  var mm = String(now.getMinutes()).padStart(2, '0');
  var ss = String(now.getSeconds()).padStart(2, '0');
  clockEl.textContent = hh + ':' + mm + ':' + ss;

  var word = getGreetingWord();
  greetEl.textContent = name ? (word + ', ' + name + '! \uD83D\uDC4B') : (word + '! \uD83D\uDC4B');

  var days   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  var months = ['Januari','Februari','Maret','April','Mei','Juni','Juli',
                'Agustus','September','Oktober','November','Desember'];
  dateEl.textContent = days[now.getDay()] + ', ' + now.getDate() + ' ' +
                       months[now.getMonth()] + ' ' + now.getFullYear();
}

nameInput.value = storage.get('userName', '');

saveNameBtn.addEventListener('click', function() {
  var name = nameInput.value.trim();
  storage.set('userName', name);
  updateClock();
  showToast(name ? ('Nama disimpan: ' + name + ' \uD83C\uDF38') : 'Nama dihapus.');
});

nameInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') saveNameBtn.click();
});

setInterval(updateClock, 1000);
updateClock();

/* ══════════════════════════════════════════════
   2. POMODORO TIMER
══════════════════════════════════════════════ */
var POMODORO_TOTAL = 25 * 60;
var CIRCUMFERENCE  = 2 * Math.PI * 70; // r=70

var pomSeconds  = POMODORO_TOTAL;
var pomRunning  = false;
var pomInterval = null;

var pomDisplay  = $('#pom-display');
var pomRingProg = $('#ring-progress');
var pomLabel    = $('#pom-label');
var btnStart    = $('#btn-pom-start');
var btnStop     = $('#btn-pom-stop');
var btnReset    = $('#btn-pom-reset');

pomRingProg.style.strokeDasharray  = CIRCUMFERENCE;
pomRingProg.style.strokeDashoffset = 0;

function updatePomDisplay() {
  var m = String(Math.floor(pomSeconds / 60)).padStart(2, '0');
  var s = String(pomSeconds % 60).padStart(2, '0');
  pomDisplay.textContent = m + ':' + s;

  var fraction = pomSeconds / POMODORO_TOTAL;
  pomRingProg.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);
}

function pomTick() {
  if (pomSeconds <= 0) {
    clearInterval(pomInterval);
    pomRunning = false;
    btnStart.textContent = '\u25B6 Start';
    pomLabel.textContent = '\uD83C\uDF89 Sesi selesai!';
    showToast('Pomodoro selesai! Istirahat sebentar \uD83C\uDF38', 'success');
    return;
  }
  pomSeconds--;
  updatePomDisplay();
  pomLabel.textContent = Math.floor(pomSeconds / 60) + ' menit tersisa';
}

btnStart.addEventListener('click', function() {
  if (pomRunning || pomSeconds <= 0) return;
  pomRunning = true;
  btnStart.textContent = '\u23F3 Berjalan\u2026';
  pomLabel.textContent = '25 menit tersisa';
  pomInterval = setInterval(pomTick, 1000);
});

btnStop.addEventListener('click', function() {
  if (!pomRunning) return;
  clearInterval(pomInterval);
  pomRunning = false;
  btnStart.textContent = '\u25B6 Lanjut';
  pomLabel.textContent = 'Dijeda';
});

btnReset.addEventListener('click', function() {
  clearInterval(pomInterval);
  pomRunning  = false;
  pomSeconds  = POMODORO_TOTAL;
  btnStart.textContent = '\u25B6 Start';
  pomLabel.textContent = '25:00 siap dimulai';
  updatePomDisplay();
});

updatePomDisplay();

/* ══════════════════════════════════════════════
   3. TO-DO LIST
══════════════════════════════════════════════ */
var tasks     = storage.get('tasks', []);
var sortMode  = 'default';
var editingId = null;

var taskInput    = $('#task-input');
var addTaskBtn   = $('#btn-add-task');
var taskListEl   = $('#task-list');
var statsDone    = $('#stats-done');
var statsTotal   = $('#stats-total');
var progressFill = $('#progress-fill');

function saveTasks() {
  storage.set('tasks', tasks);
}

function getSortedTasks() {
  var copy = tasks.slice();
  if (sortMode === 'alpha') {
    copy.sort(function(a, b) { return a.text.localeCompare(b.text, 'id'); });
  } else if (sortMode === 'done') {
    copy.sort(function(a, b) { return Number(a.done) - Number(b.done); });
  } else if (sortMode === 'done-first') {
    copy.sort(function(a, b) { return Number(b.done) - Number(a.done); });
  }
  return copy;
}

function renderTasks() {
  var sorted    = getSortedTasks();
  var doneCount = tasks.filter(function(t) { return t.done; }).length;
  var total     = tasks.length;

  statsDone.textContent  = doneCount;
  statsTotal.textContent = total;
  var pct = total ? Math.round((doneCount / total) * 100) : 0;
  progressFill.style.width = pct + '%';

  if (sorted.length === 0) {
    taskListEl.innerHTML =
      '<li class="todo-empty">' +
        '<span class="empty-icon">\uD83C\uDF37</span>' +
        'Belum ada tugas. Tambahkan sesuatu!' +
      '</li>';
    return;
  }

  taskListEl.innerHTML = '';
  sorted.forEach(function(task) {
    var li = document.createElement('li');
    li.className  = 'task-item' + (task.done ? ' done' : '');
    li.dataset.id = task.id;

    if (editingId === task.id) {
      li.innerHTML =
        '<div class="task-check">\u2713</div>' +
        '<input class="task-edit-input" type="text" value="' + escapeHtml(task.text) + '" maxlength="200">' +
        '<div class="task-actions">' +
          '<button class="btn btn-sm btn-primary btn-save-edit" title="Simpan">\uD83D\uDCBE Simpan</button>' +
          '<button class="btn btn-sm btn-secondary btn-cancel-edit" title="Batal">\u2715</button>' +
        '</div>';
    } else {
      li.innerHTML =
        '<div class="task-check" title="' + (task.done ? 'Belum selesai' : 'Selesai') + '">' +
          (task.done ? '\u2713' : '') +
        '</div>' +
        '<span class="task-text">' + escapeHtml(task.text) + '</span>' +
        '<div class="task-actions">' +
          '<button class="btn-icon edit" title="Edit">\u270F\uFE0F</button>' +
          '<button class="btn-icon delete" title="Hapus">\uD83D\uDDD1\uFE0F</button>' +
        '</div>';
    }

    taskListEl.appendChild(li);
  });
}

taskListEl.addEventListener('click', function(e) {
  var li = e.target.closest('.task-item');
  if (!li) return;
  var id = li.dataset.id;

  if (e.target.closest('.task-check')) {
    var idx = tasks.findIndex(function(t) { return t.id === id; });
    if (idx !== -1) { tasks[idx].done = !tasks[idx].done; saveTasks(); renderTasks(); }
    return;
  }

  if (e.target.closest('.btn-icon.edit')) {
    editingId = id;
    renderTasks();
    var inp = li.querySelector('.task-edit-input');
    if (inp) { inp.focus(); inp.select(); }
    return;
  }

  if (e.target.closest('.btn-save-edit')) {
    var input   = li.querySelector('.task-edit-input');
    var newText = input ? input.value.trim() : '';
    if (!newText) { showToast('Tugas tidak boleh kosong.', 'warning'); return; }
    var i = tasks.findIndex(function(t) { return t.id === id; });
    if (i !== -1) tasks[i].text = newText;
    editingId = null;
    saveTasks();
    renderTasks();
    showToast('Tugas diperbarui \uD83C\uDF38');
    return;
  }

  if (e.target.closest('.btn-cancel-edit')) {
    editingId = null;
    renderTasks();
    return;
  }

  if (e.target.closest('.btn-icon.delete')) {
    tasks = tasks.filter(function(t) { return t.id !== id; });
    if (editingId === id) editingId = null;
    saveTasks();
    renderTasks();
    showToast('Tugas dihapus.', 'warning');
    return;
  }
});

taskListEl.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && e.target.classList.contains('task-edit-input')) {
    var saveBtn = e.target.closest('.task-item').querySelector('.btn-save-edit');
    if (saveBtn) saveBtn.click();
  }
  if (e.key === 'Escape' && e.target.classList.contains('task-edit-input')) {
    var cancelBtn = e.target.closest('.task-item').querySelector('.btn-cancel-edit');
    if (cancelBtn) cancelBtn.click();
  }
});

function addTask() {
  var text = taskInput.value.trim();
  if (!text) { showToast('Tulis dulu tugasnya! \uD83C\uDF3C', 'warning'); return; }
  if (text.length > 200) { showToast('Tugas terlalu panjang.', 'warning'); return; }
  tasks.push({ id: genId(), text: text, done: false, createdAt: Date.now() });
  taskInput.value = '';
  saveTasks();
  renderTasks();
  showToast('Tugas ditambahkan \uD83C\uDF38');
}

addTaskBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') addTask(); });

$$('.sort-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    sortMode = btn.dataset.sort;
    $$('.sort-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    renderTasks();
  });
});

renderTasks();

/* ══════════════════════════════════════════════
   4. QUICK LINKS
══════════════════════════════════════════════ */
var links = storage.get('quickLinks', [
  { id: genId(), name: 'Google',  url: 'https://google.com',  emoji: '\uD83D\uDD0D' },
  { id: genId(), name: 'YouTube', url: 'https://youtube.com', emoji: '\u25B6\uFE0F' },
  { id: genId(), name: 'GitHub',  url: 'https://github.com',  emoji: '\uD83D\uDC19' }
]);

var linkNameInput  = $('#link-name-input');
var linkUrlInput   = $('#link-url-input');
var linkEmojiInput = $('#link-emoji-input');
var addLinkBtn     = $('#btn-add-link');
var linksGrid      = $('#links-grid');

function saveLinks() { storage.set('quickLinks', links); }

function renderLinks() {
  if (links.length === 0) {
    linksGrid.innerHTML = '<p class="links-empty">\uD83C\uDF37 Belum ada quick link.</p>';
    return;
  }
  linksGrid.innerHTML = '';
  links.forEach(function(link) {
    var a       = document.createElement('a');
    a.className = 'link-chip';
    a.href      = link.url;
    a.target    = '_blank';
    a.rel       = 'noopener noreferrer';
    a.dataset.id = link.id;
    a.innerHTML =
      '<div class="link-favicon">' + (link.emoji || '\uD83D\uDD17') + '</div>' +
      '<span>' + escapeHtml(link.name) + '</span>' +
      '<button class="link-delete" title="Hapus">\u2715</button>';
    linksGrid.appendChild(a);
  });
}

linksGrid.addEventListener('click', function(e) {
  var delBtn = e.target.closest('.link-delete');
  if (!delBtn) return;
  e.preventDefault();
  var chip = delBtn.closest('.link-chip');
  var id   = chip ? chip.dataset.id : null;
  links = links.filter(function(l) { return l.id !== id; });
  saveLinks();
  renderLinks();
  showToast('Link dihapus.', 'warning');
});

function addLink() {
  var name  = linkNameInput.value.trim();
  var raw   = linkUrlInput.value.trim();
  var emoji = linkEmojiInput.value.trim() || '\uD83D\uDD17';

  if (!name || !raw) { showToast('Isi nama dan URL link!', 'warning'); return; }

  var url = raw;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  try { new URL(url); } catch(e) {
    showToast('URL tidak valid.', 'warning'); return;
  }

  links.push({ id: genId(), name: name, url: url, emoji: emoji });
  linkNameInput.value  = '';
  linkUrlInput.value   = '';
  linkEmojiInput.value = '';
  saveLinks();
  renderLinks();
  showToast('Link "' + name + '" ditambahkan \uD83C\uDF3A');
}

addLinkBtn.addEventListener('click', addLink);
[linkNameInput, linkUrlInput, linkEmojiInput].forEach(function(inp) {
  inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') addLink(); });
});

renderLinks();

/* ══════════════════════════════════════════════
   5. LIGHT / DARK MODE
══════════════════════════════════════════════ */
var themeBtn  = $('#btn-theme');
var themeIcon = $('#theme-icon');
var themeText = $('#theme-text');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  storage.set('theme', theme);
  if (theme === 'dark') {
    themeIcon.textContent = '\u2600\uFE0F';
    themeText.textContent = 'Light';
  } else {
    themeIcon.textContent = '\uD83C\uDF19';
    themeText.textContent = 'Dark';
  }
}

themeBtn.addEventListener('click', function() {
  var current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

var savedTheme = storage.get('theme');
if (savedTheme) {
  applyTheme(savedTheme);
} else {
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}
