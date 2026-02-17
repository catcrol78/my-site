// song.js - с поддержкой карточек-перевёртышей (flashcards) и синхронизацией текста с видео
console.log("🎵 song.js загружен (с карточками и синхронизацией)");

const $ = id => document.getElementById(id);

// Глобальные переменные для YouTube плеера
let player;
let syncInterval;
let currentSong = null; // будет хранить объект текущей песни

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
}

function safeText(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return String(obj);
}

function showError(message) {
  hideLoader();
  const notFound = document.getElementById('not-found');
  if (notFound) {
    notFound.style.display = 'block';
    notFound.textContent = message;
  } else {
    alert(message);
  }
}

const urlParams = new URLSearchParams(window.location.search);
const songId = parseInt(urlParams.get('id'));

document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM загружен, ищем песню с ID:", songId);
  
  if (typeof songsDataFromExternal === 'undefined') {
    showError('Данные не загружены. Файл songs-data.js не найден или содержит ошибку.');
    return;
  }
  
  const song = songsDataFromExternal.find(s => s.id === songId);
  
  if (!song) {
    showError(`Песня с ID ${songId} не найдена в базе.`);
    return;
  }
  
  console.log("Песня найдена:", song);
  currentSong = song; // сохраняем для доступа из функций синхронизации
  renderSong(song);
  initPlayer(); // ✅ CSP-safe инициализация YouTube через embed + enablejsapi
});

// ===============================
// YouTube без iframe_api.js (CSP-safe)
// Вместо YT.Player используем embed + enablejsapi=1 и postMessage.
// ===============================
let ytIframe = null;
let ytLastTime = 0;
let ytReady = false;

// Заглушка "player", чтобы остальной код мог вызывать player.getCurrentTime()
player = {
  getCurrentTime: () => ytLastTime
};

function initPlayer() {
  if (!currentSong || !currentSong.youtubeId) return;

  ytIframe = document.getElementById('video-iframe');
  if (!ytIframe) return;

  const origin = encodeURIComponent(window.location.origin);
  const videoId = encodeURIComponent(currentSong.youtubeId);

  // ВАЖНО: enablejsapi=1 позволяет получать currentTime и управлять плеером через postMessage
  ytIframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${origin}&playsinline=1&rel=0`;

  // Как только iframe загрузился — подписываемся на события
  ytIframe.addEventListener('load', () => {
    ytPost({ event: 'listening', id: 'yt1' });

    // Запускаем синхронизацию сразу: currentTime будет обновляться во время проигрывания
    if (!ytReady) {
      ytReady = true;
      startSyncInterval();
    }
  });
}

function ytPost(obj) {
  if (!ytIframe || !ytIframe.contentWindow) return;
  ytIframe.contentWindow.postMessage(JSON.stringify(obj), '*');
}

// Принимаем сообщения от YouTube (currentTime приходит как infoDelivery)
window.addEventListener('message', (e) => {
  if (!e || !e.data) return;

  let data;
  try {
    data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
  } catch {
    return;
  }

  if (data && data.event === 'infoDelivery' && data.info && typeof data.info.currentTime === 'number') {
    ytLastTime = data.info.currentTime;
  }
});

// Оставляем для совместимости: если iframe_api.js всё-таки подключён, он может вызвать эту функцию.
// Но мы не зависим от неё.
function onYouTubeIframeAPIReady() {
  initPlayer();
}

function startSyncInterval() {
  // Запускаем интервал только если у песни есть временные метки
  if (!currentSong || !hasTimestamps(currentSong)) {
    return;
  }
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    if (player && player.getCurrentTime && currentSong) {
      const currentTimeSec = player.getCurrentTime();
      highlightCurrentLyric(currentTimeSec * 1000); // переводим в миллисекунды
    }
  }, 100); // проверяем каждые 100 мс
}

function stopSyncInterval() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// Проверка: есть ли в песне временные метки в lyrics
function hasTimestamps(song) {
  if (!song || !song.lyrics) return false;
  return song.lyrics.some(line => line && line.time && parseTimeToMs(line.time) > 0);
}

// Парсинг времени формата m:ss или mm:ss в миллисекунды
function parseTimeToMs(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(p => p.trim());
  if (parts.length !== 2) return 0;
  const min = parseInt(parts[0], 10);
  const sec = parseFloat(parts[1]);
  if (isNaN(min) || isNaN(sec)) return 0;
  return (min * 60 + sec) * 1000;
}

// Подсветка текущей строки
function highlightCurrentLyric(currentMs) {
  const lines = document.querySelectorAll('#lyrics-container .lyric-line');
  if (!lines.length || !currentSong || !currentSong.lyrics) return;

  // Находим последнюю строку, чьё время <= currentMs
  let activeIndex = -1;
  for (let i = 0; i < currentSong.lyrics.length; i++) {
    const l = currentSong.lyrics[i];
    const lineTime = parseTimeToMs(l.time);
    if (lineTime === 0 || isNaN(lineTime)) continue;
    if (lineTime <= currentMs) activeIndex = i;
  }

  lines.forEach((el, idx) => {
    if (idx === activeIndex) el.classList.add('active');
    else el.classList.remove('active');
  });

  // Автопрокрутка к активной строке
  if (activeIndex >= 0 && lines[activeIndex]) {
    lines[activeIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function renderSong(song) {
  $('song-title').textContent = safeText(song.title);
  $('song-artist').textContent = song.artist || '';
  
  // Текст песни
  renderLyrics(song.lyrics);
  
  // Проверяем наличие временных меток
  if (!hasTimestamps(song)) {
    console.log("У этой песни нет временных меток, синхронизация отключена");
  }
  
  // Задания
  renderTasks(song.tasks);
  
  // Лексика
  renderVocabulary(song.vocabulary);
  
  // Карточки
  const flashcardTask = (song.tasks || []).find(t => t.type === 'flashcards');
  const flashcards = flashcardTask ? flashcardTask.flashcards : null;
  renderFlashcards(flashcards);
  
  // Ограничения
  renderLimitations(song.limitations);
  
  // Культура
  renderCulture(song.culture);
  
  // Грамматика
  renderGrammar(song.grammar);

  // Теги
  renderTags(song.tags);

  // Работа с видео
  if (song.youtubeId) {
    // CSP-safe: просто выставляем embed src + включаем jsapi
    initPlayer();
  }
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `tab-${tab.dataset.tab}`;
      const target = document.getElementById(targetId);
      if (target) target.classList.add('active');
    });
  });
}

function renderTags(tags) {
  const container = document.getElementById('song-tags');
  if (!container) return;
  container.innerHTML = '';
  if (!tags || !tags.length) return;

  tags.forEach(tag => {
    const el = document.createElement('span');
    el.className = 'tag';
    el.textContent = tag;
    container.appendChild(el);
  });
}

function renderLyrics(lyrics) {
  const container = document.getElementById('lyrics-container');
  if (!container) return;
  container.innerHTML = '';

  if (!lyrics || !lyrics.length) {
    container.textContent = 'Текст песни не указан.';
    return;
  }

  lyrics.forEach((line, idx) => {
    const p = document.createElement('p');
    p.className = 'lyric-line';
    p.dataset.index = idx;
    p.textContent = line.text || '';

    // Клик по строке — перемотка (работает только если есть timestamps и iframe присылает время)
    p.addEventListener('click', () => {
      const ms = parseTimeToMs(line.time);
      if (ms > 0 && ytIframe) {
        // Прыжок к времени через postMessage-команду seekTo
        ytPost({ event: 'command', func: 'seekTo', args: [ms / 1000, true] });
      }
    });

    container.appendChild(p);
  });
}

function renderTasks(tasks) {
  const container = document.getElementById('tasks-container');
  if (!container) return;
  container.innerHTML = '';

  if (!tasks || !tasks.length) {
    container.textContent = 'Задания не добавлены.';
    return;
  }

  tasks.forEach(task => {
    if (task.type === 'flashcards') return; // карточки показываем отдельно

    const card = document.createElement('div');
    card.className = 'task-card';

    const h3 = document.createElement('h3');
    h3.textContent = task.title || 'Задание';
    card.appendChild(h3);

    if (task.text) {
      const p = document.createElement('p');
      p.textContent = task.text;
      card.appendChild(p);
    }

    if (task.items && Array.isArray(task.items)) {
      const ul = document.createElement('ul');
      task.items.forEach(it => {
        const li = document.createElement('li');
        li.textContent = it;
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }

    container.appendChild(card);
  });
}

function renderVocabulary(vocab) {
  const container = document.getElementById('vocab-container');
  if (!container) return;
  container.innerHTML = '';

  if (!vocab || !vocab.length) {
    container.textContent = 'Лексика не добавлена.';
    return;
  }

  const table = document.createElement('table');
  table.className = 'vocab-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr><th>Слово</th><th>Перевод</th><th>Пример</th></tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  vocab.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${safeText(v.word)}</td>
      <td>${safeText(v.translation)}</td>
      <td>${safeText(v.example)}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.appendChild(table);
}

function renderGrammar(grammar) {
  const container = document.getElementById('grammar-container');
  if (!container) return;
  container.innerHTML = '';

  if (!grammar) {
    container.textContent = 'Грамматика не добавлена.';
    return;
  }

  const p = document.createElement('div');
  p.className = 'rich-text';
  p.innerHTML = grammar; // предполагается HTML из админки
  container.appendChild(p);
}

function renderCulture(culture) {
  const container = document.getElementById('culture-container');
  if (!container) return;
  container.innerHTML = '';

  if (!culture) {
    container.textContent = 'Культура не добавлена.';
    return;
  }

  const p = document.createElement('div');
  p.className = 'rich-text';
  p.innerHTML = culture;
  container.appendChild(p);
}

function renderLimitations(limitations) {
  const container = document.getElementById('limits-container');
  if (!container) return;
  container.innerHTML = '';

  if (!limitations) {
    container.textContent = 'Ограничения не указаны.';
    return;
  }

  const p = document.createElement('div');
  p.className = 'rich-text';
  p.innerHTML = limitations;
  container.appendChild(p);
}

// --------------------
// Flashcards
// --------------------
function renderFlashcards(flashcards) {
  const container = document.getElementById('cards-container');
  if (!container) return;
  container.innerHTML = '';

  if (!flashcards || !flashcards.length) {
    container.textContent = 'Карточки не добавлены.';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'flashcards-grid';

  flashcards.forEach((card, idx) => {
    const flip = document.createElement('div');
    flip.className = 'flashcard';
    flip.tabIndex = 0;

    const inner = document.createElement('div');
    inner.className = 'flashcard-inner';

    const front = document.createElement('div');
    front.className = 'flashcard-front';
    front.innerHTML = `<div class="flashcard-title">${safeText(card.frontTitle || 'Слово')}</div>
                       <div class="flashcard-text">${safeText(card.front)}</div>`;

    const back = document.createElement('div');
    back.className = 'flashcard-back';
    back.innerHTML = `<div class="flashcard-title">${safeText(card.backTitle || 'Перевод')}</div>
                      <div class="flashcard-text">${safeText(card.back)}</div>`;

    inner.appendChild(front);
    inner.appendChild(back);
    flip.appendChild(inner);

    flip.addEventListener('click', () => flip.classList.toggle('flipped'));
    flip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flip.classList.toggle('flipped');
      }
    });

    grid.appendChild(flip);
  });

  container.appendChild(grid);
}

// --------------------
// Доп. UI: Toast
// --------------------
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}
