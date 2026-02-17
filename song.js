// song.js — Финальная версия с карточками и без лишних вкладок
console.log("🎵 song.js загружен (Final Version)");

// ===== Глобальные переменные =====
let ytIframe = null;
let ytLastTime = 0;
let syncInterval;
let currentSong = null;
let isUserScrolling = false;
let scrollTimeout;

const player = {
  getCurrentTime: () => ytLastTime,
  seekTo: (seconds, allowSeekAhead) => {
    if (ytIframe && ytIframe.contentWindow) {
      ytPost({ event: 'command', func: 'seekTo', args: [seconds, allowSeekAhead] });
    }
  },
  playVideo: () => {
    if (ytIframe && ytIframe.contentWindow) {
      ytPost({ event: 'command', func: 'playVideo', args: [] });
    }
  }
};

const $ = id => document.getElementById(id);

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
}

function safeText(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj.ru || obj.es || '';
}

function escapeHtml(str) {
  return (str ?? '').toString().replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

const urlParams = new URLSearchParams(window.location.search);
const songId = parseInt(urlParams.get('id'));

document.addEventListener('DOMContentLoaded', function() {
  if (typeof songsDataFromExternal === 'undefined') return alert('Ошибка данных');
  const song = songsDataFromExternal.find(s => s.id === songId);
  if (!song) return alert('Песня не найдена');
  
  currentSong = song;
  renderSong(song);

  const lyricsContainer = document.getElementById('lyrics-content');
  if (lyricsContainer) {
    lyricsContainer.addEventListener('scroll', () => {
      isUserScrolling = true;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => isUserScrolling = false, 2000);
    });
  }
});

function renderSong(song) {
  const titleEl = $('song-title');
  if (titleEl) titleEl.textContent = safeText(song.title);
  const artistEl = $('song-artist');
  if (artistEl) artistEl.textContent = song.artist || '';

  renderLyrics(song.lyrics);
  renderTasks(song.tasks);
  renderVocabulary(song.vocabulary);
  
  // Убраны вызовы renderGrammar, renderCulture, renderRestrictions

  const flashcardTask = (song.tasks || []).find(t => t.type === 'flashcards');
  renderFlashcards(flashcardTask ? flashcardTask.flashcards : null);
  renderBadges(song);

  const contentEl = $('song-content');
  if (contentEl) contentEl.style.display = ''; // Показываем контент

  hideLoader();
  setupTabs();
  if (song.youtubeId) initPlayerPostMessage();
}

function setupTabs() {
  const tabs = document.querySelectorAll('.detail-tab');
  const panels = document.querySelectorAll('.detail-panel');
  if (!tabs.length || !panels.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const activePanel = document.querySelector(`[data-panel="${tabName}"]`);
      if (activePanel) activePanel.classList.add('active');
    });
  });
}

function renderLyrics(lyrics) {
  const container = $('lyrics-content');
  if (!container) return;
  if (!lyrics || !lyrics.length) {
    container.innerHTML = '<p class="muted">Текст пока не добавлен</p>';
    return;
  }
  let html = '';
  lyrics.forEach((line, index) => {
    html += `<p class="lyric-line" data-index="${index}" data-time="${line.time || ''}">${escapeHtml(line.text)}</p>`;
  });
  container.innerHTML = html;
  setTimeout(makeLyricsClickable, 100);
}

function renderVocabulary(vocab) {
  const container = $('vocab-content');
  if (!container) return;
  if (!vocab || !vocab.length) {
    container.innerHTML = '<p class="muted">Лексика пока не добавлена</p>';
    return;
  }
  container.innerHTML = vocab.map(w => `<span class="chip">${escapeHtml(w)}</span>`).join('');
}

function renderBadges(song) {
  const badgesDiv = $('song-badges');
  if (!badgesDiv) return;
  const badges = [];
  if (song.level) badges.push(`<span class="badge"><i class="fas fa-signal"></i> ${song.level.join(', ')}</span>`);
  if (song.themes) song.themes.forEach(t => badges.push(`<span class="badge"><i class="fas fa-tag"></i> ${escapeHtml(t)}</span>`));
  badgesDiv.innerHTML = badges.join('');
}

function renderTasks(tasks) {
  const container = $('tasks-container');
  if (!container) return;
  container.innerHTML = '';
  if (!tasks || !tasks.length) {
    container.innerHTML = '<p class="muted">Заданий нет</p>';
    return;
  }
  tasks.forEach((task, index) => {
    if (task.type === 'flashcards') return; // flashcards обрабатываются отдельно
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-block';
    const header = document.createElement('div');
    header.className = 'task-header';
    header.innerHTML = `<h3>${safeText(task.title) || `Задание ${index + 1}`}</h3><span class="task-type-badge">${task.type || 'задание'}</span>`;
    taskDiv.appendChild(header);
    if (task.instruction) {
      const instr = document.createElement('div');
      instr.className = 'task-instruction';
      instr.innerHTML = `<i class="fas fa-info-circle"></i> ${safeText(task.instruction)}`;
      taskDiv.appendChild(instr);
    }
    const contentDiv = document.createElement('div');
    contentDiv.className = 'task-content';
    if(task.type === 'gapfill') renderGapFill(contentDiv, task);
    else if(task.type === 'quiz') renderQuiz(contentDiv, task);
    else if(task.type === 'match') renderMatchTask(contentDiv, task);
    else renderDefault(contentDiv, task);
    taskDiv.appendChild(contentDiv);
    container.appendChild(taskDiv);
  });
}

function renderDefault(container, task) {
  if (task.content) { const p = document.createElement('p'); p.textContent = task.content; container.appendChild(p); }
  if (task.wordBank) {
    const bankDiv = document.createElement('div'); bankDiv.className = 'word-bank';
    bankDiv.innerHTML = '<strong>Слова:</strong> ' + task.wordBank.map(w => `<span class="chip">${escapeHtml(w)}</span>`).join('');
    container.appendChild(bankDiv);
  }
}

function renderGapFill(container, task) {
  if (!task.text) return;
  const parts = task.text.split('___');
  const answers = task.answers || [];
  const options = task.options || [];
  const form = document.createElement('div'); form.className = 'gap-fill-form';
  parts.forEach((part, idx) => {
    if (part) { const span = document.createElement('span'); span.textContent = part; form.appendChild(span); }
    if (idx < parts.length - 1) {
      if (options[idx] && Array.isArray(options[idx])) {
        const select = document.createElement('select'); select.className = 'gap-select';
        const def = document.createElement('option'); def.textContent = '...'; select.appendChild(def);
        options[idx].forEach(opt => { const o = document.createElement('option'); o.value = opt; o.textContent = opt; select.appendChild(o); });
        form.appendChild(select);
      } else {
        const input = document.createElement('input'); input.className = 'gap-input'; input.placeholder = '...'; form.appendChild(input);
      }
    }
  });
  container.appendChild(form);
  if (answers.length) {
    const btn = document.createElement('button'); btn.className = 'check-btn'; btn.textContent = 'Проверить';
    const res = document.createElement('div'); res.className = 'result-message'; res.style.display = 'none';
    btn.onclick = () => {
      const inputs = form.querySelectorAll('.gap-input, .gap-select');
      let corr = 0;
      inputs.forEach((inp, i) => {
        if(inp.value.trim().toLowerCase() === answers[i].toLowerCase()){ inp.style.borderColor='green'; corr++; } else { inp.style.borderColor='red'; }
      });
      res.textContent = corr===answers.length ? '✅ Верно!' : `❌ ${corr}/${answers.length}`;
      res.className = `result-message ${corr===answers.length?'correct':'incorrect'}`; res.style.display='block';
    };
    container.appendChild(btn); container.appendChild(res);
  }
}

function renderQuiz(container, task) {
  if (!task.questions) return;
  const form = document.createElement('div');
  task.questions.forEach((q, i) => {
    const div = document.createElement('div'); div.className = 'quiz-question';
    div.innerHTML = `<p><strong>${q.question}</strong></p>`;
    q.options.forEach((opt, oi) => {
      const lbl = document.createElement('label'); lbl.className = 'quiz-option';
      lbl.innerHTML = `<input type="radio" name="q_${i}" value="${oi}"> ${opt}`;
      div.appendChild(lbl);
    });
    form.appendChild(div);
  });
  container.appendChild(form);
  const btn = document.createElement('button'); btn.className = 'check-btn'; btn.textContent = 'Проверить';
  const res = document.createElement('div'); res.className = 'result-message'; res.style.display = 'none';
  btn.onclick = () => {
    let corr = 0;
    task.questions.forEach((q, i) => { const sel = document.querySelector(`input[name="q_${i}"]:checked`); if(sel && +sel.value===q.correct) corr++; });
    res.textContent = corr===task.questions.length ? '✅ Верно!' : `❌ ${corr}/${task.questions.length}`;
    res.className = `result-message ${corr===task.questions.length?'correct':'incorrect'}`; res.style.display='block';
  };
  container.appendChild(btn); container.appendChild(res);
}

function renderMatchTask(container, task) {
  if (!task.pairs) return;
  const grid = document.createElement('div'); grid.className = 'match-grid';
  const lCol = document.createElement('div'); lCol.className = 'match-column';
  const rCol = document.createElement('div'); rCol.className = 'match-column';
  let sel = null; const matched = new Set();
  task.pairs.forEach((p, i) => {
    const l = document.createElement('div'); l.className = 'match-item'; l.textContent = p.left; l.dataset.id = i;
    l.onclick = () => { if(matched.has(i))return; if(sel===l){l.classList.remove('selected');sel=null;}else{document.querySelectorAll('.match-item.selected').forEach(e=>e.classList.remove('selected'));l.classList.add('selected');sel=l;} };
    const r = document.createElement('div'); r.className = 'match-item'; r.textContent = p.right; r.dataset.id = i;
    r.onclick = () => { if(matched.has(i))return; if(sel && sel.dataset.id===String(i)){ sel.classList.add('matched','s');sel.classList.remove('selected');r.classList.add('matched');matched.add(i);sel=null; } };
    lCol.appendChild(l); rCol.appendChild(r);
  });
  grid.appendChild(lCol); grid.appendChild(rCol); container.appendChild(grid);
}

function renderFlashcards(flashcards) {
  const container = $('flashcard-wrapper');
  const emptyDiv = $('flashcards-empty');
  const counter = $('flashcards-counter');
  const prevBtn = $('flashcards-prev');
  const nextBtn = $('flashcards-next');
  // ИСПРАВЛЕНО: убраны решётки перед ID
  const progressFill = $('flashcards-progress-fill');
  const progressText = $('flashcards-progress-text');
  const resetBtn = $('flashcards-reset');

  if (!flashcards || !flashcards.length) {
    if (emptyDiv) emptyDiv.style.display = 'block';
    if (container) container.innerHTML = '';
    if (counter) counter.textContent = '0/0';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0/0';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  if (emptyDiv) emptyDiv.style.display = 'none';

  let currentIndex = 0;
  // Массив для отметки выученных карточек
  let learned = new Array(flashcards.length).fill(false);

  // Функция обновления прогресс-бара
  function updateProgress() {
    if (!progressFill || !progressText) return;
    const learnedCount = learned.filter(v => v).length;
    const percent = (learnedCount / flashcards.length) * 100;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${learnedCount}/${flashcards.length}`;
  }

  // Функция обновления карточки и кнопок
  function updateCard() {
    if (!container || !flashcards.length) return;
    const card = flashcards[currentIndex];
    const isLearned = learned[currentIndex];

    container.innerHTML = `
      <div class="flashcard ${isLearned ? 'flashcard-learned' : ''}">
        <div class="flashcard-front">
          <div class="word">${escapeHtml(card.es || card.word || '')}</div>
          ${card.transcription ? `<div class="transcription">${escapeHtml(card.transcription)}</div>` : ''}
          ${isLearned ? '<div class="learned-stamp"><i class="fas fa-check-circle"></i> Выучено</div>' : ''}
        </div>
        <div class="flashcard-back">
          <div class="translation">${escapeHtml(card.ru || card.translation || '')}</div>
          ${card.example ? `<div class="example">${escapeHtml(card.example)}</div>` : ''}
          ${card.example_translation ? `<div class="example-translation">${escapeHtml(card.example_translation)}</div>` : ''}
        </div>
      </div>
      <div class="flashcard-footer-actions" style="display: flex; justify-content: center; margin-top: 10px;">
        <button class="flashcards-btn learn-toggle ${isLearned ? 'danger' : ''}" style="min-width: 120px;">
          <i class="fas ${isLearned ? 'fa-times' : 'fa-check'}"></i>
          ${isLearned ? 'Не выучено' : '✓ Знаю'}
        </button>
      </div>`;

    // Обработчик переворота карточки
    const flashcardEl = container.querySelector('.flashcard');
    if (flashcardEl) {
      flashcardEl.onclick = function (e) {
        // Игнорируем клик, если кликнули на кнопку внутри
        if (e.target.closest('button')) return;
        this.classList.toggle('flipped');
      };
    }

    // Обработчик кнопки "Знаю"/"Не выучено"
    const toggleBtn = container.querySelector('.learn-toggle');
    if (toggleBtn) {
      toggleBtn.onclick = (e) => {
        e.stopPropagation(); // Не переворачивать карточку
        learned[currentIndex] = !learned[currentIndex];
        updateProgress();
        updateCard(); // перерисовать карточку с обновлённым статусом
      };
    }

    // Обновляем счётчик
    if (counter) counter.textContent = `${currentIndex + 1}/${flashcards.length}`;

    // Обновляем состояние кнопок навигации
    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    if (nextBtn) nextBtn.disabled = currentIndex === flashcards.length - 1;
  }

  // Обработчики навигации
  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentIndex > 0) {
        currentIndex--;
        updateCard();
      }
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentIndex < flashcards.length - 1) {
        currentIndex++;
        updateCard();
      }
    };
  }

  // Сброс прогресса
  if (resetBtn) {
    resetBtn.onclick = () => {
      learned.fill(false);
      updateProgress();
      updateCard(); // обновить текущую карточку (снимется пометка)
    };
  }

  // Инициализация
  updateProgress();
  updateCard();
}

function initPlayerPostMessage() {
  if (!currentSong || !currentSong.youtubeId) return;
  ytIframe = document.getElementById('video-iframe');
  if (!ytIframe) return;
  let origin = window.location.origin;
  if (!origin || origin === 'null' || origin === 'file://') origin = 'https://www.youtube.com';
  ytIframe.src = `https://www.youtube.com/embed/${currentSong.youtubeId}?enablejsapi=1&origin=${encodeURIComponent(origin)}&playsinline=1&rel=0`;
  ytIframe.onload = () => {
    ytPost({ event: 'listening', id: 'yt1' });
    startSyncInterval();
  };
}

function ytPost(obj) { if (ytIframe && ytIframe.contentWindow) ytIframe.contentWindow.postMessage(JSON.stringify(obj), '*'); }

window.addEventListener('message', (e) => {
  try { const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
  if (d && d.event === 'infoDelivery' && d.info && typeof d.info.currentTime === 'number') ytLastTime = d.info.currentTime; } catch {}
});

function startSyncInterval() {
  if (syncInterval) clearInterval(syncInterval);
  if (!currentSong.lyrics) return;
  syncInterval = setInterval(() => highlightCurrentLyric(ytLastTime * 1000), 200);
}

function parseTimeToMs(time) {
  if (!time) return 0;
  const parts = time.toString().split(':');
  if (parts.length === 2) return (parseInt(parts[0])*60 + parseFloat(parts[1].replace(',','.')))*1000;
  return 0;
}

function highlightCurrentLyric(timeMs) {
  if (!currentSong.lyrics) return;
  let activeIndex = -1;
  for (let i = 0; i < currentSong.lyrics.length; i++) {
    const t = parseTimeToMs(currentSong.lyrics[i].time);
    if (t <= timeMs && t > 0) activeIndex = i; else if (t > timeMs) break;
  }
  const curr = document.querySelector('.lyric-line.active');
  const next = document.querySelector(`.lyric-line[data-index="${activeIndex}"]`);
  if (curr !== next) {
    if (curr) curr.classList.remove('active');
    if (next) {
      next.classList.add('active');
      if (!isUserScrolling) next.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

function makeLyricsClickable() {
  document.querySelectorAll('.lyric-line').forEach(line => {
    line.onclick = () => {
      const ms = parseTimeToMs(currentSong.lyrics[line.dataset.index].time);
      if(ms > 0) player.seekTo(ms/1000, true);
    };
  });
}
