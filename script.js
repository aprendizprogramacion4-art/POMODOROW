
(() => {
  'use strict';

  const STORAGE_KEY = 'pomo-cfg';
  const SESSIONS_BEFORE_LONG = 4;        
  const CHIME_NOTES = [659, 784, 988];   
  const RING_RADIUS = 130;               
  const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

  const DEFAULTS = { work: 25, short: 5, long: 15, sound: true };
  const LIMITS = { work: [1, 90], short: [1, 30], long: [1, 60] };
  const MODE_NAMES = { work: 'enfoque', short: 'descanso', long: 'descanso largo' };
  const STATUS_TEXT = { idle: 'Listo para empezar', paused: 'En pausa' };
  const GO_LABEL = { idle: 'Iniciar', running: 'Pausar', paused: 'Reanudar' };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const formatTime = (seconds) => {
    const total = Math.ceil(seconds);
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const escapeHTML = (text) =>
    text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function loadConfig() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {}

    const config = { ...DEFAULTS, sound: saved.sound !== false };
    for (const mode of Object.keys(LIMITS)) {
      config[mode] = clamp(Math.round(Number(saved[mode])) || DEFAULTS[mode], ...LIMITS[mode]);
    }
    return config;
  }

  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (e) {}
  }

  const cfg = loadConfig();
  const state = {
    mode: 'work',     
    total: 0,         
    left: 0,          
    running: false,
    endsAt: 0,        
  };
  let sessions = 0;   
  let timerId = null;
  let audioCtx = null;
  let tasks = [];     
  let activeTaskId = null;
  let nextTaskId = 1;

  const $ = (selector) => document.querySelector(selector);
  const el = {
    app: $('.app'),
    time: $('.time'),
    status: $('.status'),
    ring: $('.prg'),
    go: $('#go'),
    reset: $('#rst'),
    skip: $('#skp'),
    sound: $('#snd'),
    note: $('#note'),
    count: $('#n'),
    dots: $('.dots'),
    tabs: document.querySelectorAll('.tabs button'),
    form: $('#add'),
    input: $('#ti'),
    list: $('#list'),
    summary: $('#sum'),
    fields: { work: $('#c-work'), short: $('#c-short'), long: $('#c-long') },
  };

  function prepareAudio() {
    if (!cfg.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      audioCtx.resume().catch(() => {});
    } catch (e) {}
  }

  function playChime() {
    prepareAudio();
    if (!cfg.sound || !audioCtx) return;

    CHIME_NOTES.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const start = audioCtx.currentTime + i * 0.22;

      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.03);        
      gain.gain.exponentialRampToValueAtTime(0.001, start + 1.1);   
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 1.2);
    });
  }

  const remainingSeconds = () => Math.max(0, (state.endsAt - Date.now()) / 1000);

  const getPhase = () => (state.running ? 'running' : state.left < state.total ? 'paused' : 'idle');

  function setMode(mode) {
    clearInterval(timerId);
    state.mode = mode;
    state.running = false;
    state.total = state.left = cfg[mode] * 60;
    render();
  }

  function toggle() {
    if (state.running) {
      state.left = remainingSeconds();
      state.running = false;
      clearInterval(timerId);
    } else {
      if (state.left <= 0) state.left = state.total;
      prepareAudio();
      state.endsAt = Date.now() + state.left * 1000;
      state.running = true;
      el.note.textContent = '';
      timerId = setInterval(tick, 200);
    }
    render();
  }

  function tick() {
    state.left = remainingSeconds();
    if (state.left <= 0) finish();
    else render();
  }

  function finish() {
    clearInterval(timerId);
    state.running = false;

    let next = 'work';
    let message = 'Descanso terminado. Vuelve al enfoque cuando quieras.';

    if (state.mode === 'work') {
      sessions++;
      const task = tasks.find((t) => t.id === activeTaskId);
      if (task) task.sessions++;
      next = sessions % SESSIONS_BEFORE_LONG === 0 ? 'long' : 'short';
      message = 'Sesión completada. Hora de descansar.';
    }

    playChime();
    setMode(next);
    el.note.textContent = message;
    renderTasks();
  }

  function skip() {
    el.note.textContent = '';
    setMode(state.mode === 'work' ? 'short' : 'work');
  }

  function render() {
    const phase = getPhase();

    el.app.dataset.mode = state.mode;     
    el.app.dataset.state = phase;         
    el.time.textContent = formatTime(state.left);

    
    el.ring.style.strokeDashoffset = (RING_LENGTH * state.left) / state.total;
    el.ring.style.opacity = phase === 'idle' ? 0 : 1;

    el.status.textContent = phase === 'running' ? `En curso: ${MODE_NAMES[state.mode]}` : STATUS_TEXT[phase];
    el.go.textContent = GO_LABEL[phase];
    el.tabs.forEach((tab) => tab.setAttribute('aria-pressed', tab.dataset.m === state.mode));

    
    el.count.textContent = sessions;
    const inLongBreak = sessions > 0 && sessions % SESSIONS_BEFORE_LONG === 0 && state.mode === 'long';
    const filled = inLongBreak ? SESSIONS_BEFORE_LONG : sessions % SESSIONS_BEFORE_LONG;
    [...el.dots.children].forEach((dot, i) => dot.classList.toggle('on', i < filled));

    document.title = phase === 'idle' ? 'Pomodoro' : `${formatTime(state.left)} - ${MODE_NAMES[state.mode]}`;
  }
  
  function taskMeta(task) {
    const parts = [];
    if (task.id === activeTaskId) parts.push('En foco');
    if (task.sessions) parts.push(`${task.sessions} ${task.sessions === 1 ? 'sesión' : 'sesiones'}`);
    return parts.length ? `<small>${parts.join(', ')}</small>` : '';
  }

  function taskItem(task) {
    const isActive = task.id === activeTaskId;
    return `
      <li class="task${task.done ? ' done' : ''}${isActive ? ' act' : ''}" data-id="${task.id}">
        <button class="chk" data-action="check"
          aria-label="${task.done ? 'Marcar como pendiente' : 'Marcar como hecha'}">${task.done ? '✓' : ''}</button>
        <div class="body">
          <button class="txt" data-action="focus" aria-pressed="${isActive}">${escapeHTML(task.text)}</button>
          ${taskMeta(task)}
        </div>
        <button class="del" data-action="delete" aria-label="Eliminar tarea">X</button>
      </li>`;
  }

  function renderTasks() {
    el.list.innerHTML = tasks.length
      ? tasks.map(taskItem).join('')
      : '<li class="empty">Añade lo que quieres lograr en esta sesión.</li>';

    const doneCount = tasks.filter((t) => t.done).length;
    el.summary.textContent = tasks.length
      ? `${doneCount} de ${tasks.length} hechas. Toca una tarea para ponerla en foco.`
      : 'Aún no hay tareas.';
  }

  function addTask(text) {
    const task = { id: nextTaskId++, text, done: false, sessions: 0 };
    tasks.push(task);
    if (activeTaskId === null) activeTaskId = task.id;
  }

  function handleTaskAction(action, task) {
    if (action === 'focus' && !task.done) {
      activeTaskId = activeTaskId === task.id ? null : task.id;
    } else if (action === 'check') {
      task.done = !task.done;
      if (task.done && activeTaskId === task.id) activeTaskId = null;
    } else if (action === 'delete') {
      tasks = tasks.filter((t) => t.id !== task.id);
      if (activeTaskId === task.id) activeTaskId = null;
    }
  }
  
  el.go.addEventListener('click', toggle);
  el.skip.addEventListener('click', skip);
  el.reset.addEventListener('click', () => {
    el.note.textContent = '';
    setMode(state.mode);
  });

  el.tabs.forEach((tab) =>
    tab.addEventListener('click', () => {
      el.note.textContent = '';
      setMode(tab.dataset.m);
    })
  );

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = el.input.value.trim();
    if (!text) return;
    addTask(text);
    el.input.value = '';
    renderTasks();
  });
  
  el.list.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const id = Number(button.closest('.task').dataset.id);
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    handleTaskAction(button.dataset.action, task);
    renderTasks();
  });

  Object.keys(el.fields).forEach((mode) => {
    const input = el.fields[mode];
    [input.min, input.max] = LIMITS[mode];
    input.value = cfg[mode];
    input.addEventListener('change', () => {
      cfg[mode] = clamp(Math.round(Number(input.value)) || cfg[mode], ...LIMITS[mode]);
      input.value = cfg[mode];
      saveConfig();
      if (state.mode === mode && getPhase() === 'idle') setMode(mode);
    });
  });

  function updateSoundButton() {
    el.sound.setAttribute('aria-pressed', cfg.sound);
    el.sound.textContent = `Sonido al terminar: ${cfg.sound ? 'activado' : 'desactivado'}`;
  }

  el.sound.addEventListener('click', () => {
    cfg.sound = !cfg.sound;
    saveConfig();
    updateSoundButton();
    if (cfg.sound) playChime();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      toggle();
    }
  });

  el.ring.style.strokeDasharray = RING_LENGTH;
  el.dots.innerHTML = '<i></i>'.repeat(SESSIONS_BEFORE_LONG);
  updateSoundButton();
  setMode('work');
  renderTasks();
})();
