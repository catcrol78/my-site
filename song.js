// song.js — с добавленной вкладкой Грамматика
console.log("🎵 song.js загружен");

// ===== Глобальные переменные =====
let ytIframe = null;
let ytLastTime = 0;
let syncInterval;
let currentSong = null;
let isUserScrolling = false;
let scrollTimeout;
let liveTasks = [];
let completedLiveTasks = new Set();
let livePopup = null;
let liveTasksEnabled = true;
let lyricsHighlightEnabled = true;
let translationsVisible = false;
// ===== i18n для страницы песни =====
const i18nSong = {
  ru: {
    tabLyrics: "Текст",
    tabTasks: "Задания",
    tabVocab: "Лексика",
    tabFlashcards: "Карточки",
    lyricsHeader: "Текст песни",
    tasksHeader: "Задания",
    vocabHeader: "Лексика",
    flashcardsHeader: "Карточки для запоминания",
    downloadPdf: "Скачать PDF (материалы)",
    openMiro: "Доска Miro",
    noLyrics: "Текст пока не добавлен",
    noTasks: "Заданий нет",
    noVocab: "Лексика пока не добавлена",
    noFlashcards: "Карточек пока нет",
    checkAnswer: "Проверить",
    correct: "✅ Верно!",
    incorrect: "❌ Неверно",
    showTranslation: "Показать перевод",
    hideTranslation: "Скрыть перевод",
    liveTasksOn: "Живые задания включены",
    liveTasksOff: "Живые задания отключены",
    highlightOn: "Подсветка текста включена",
    highlightOff: "Подсветка текста отключена",
    translationsOn: "Переводы показаны",
    translationsOff: "Переводы скрыты",
  },
  es: {
    tabLyrics: "Letra",
    tabTasks: "Ejercicios",
    tabVocab: "Vocabulario",
    tabFlashcards: "Tarjetas",
    lyricsHeader: "Letra de la canción",
    tasksHeader: "Ejercicios",
    vocabHeader: "Vocabulario",
    flashcardsHeader: "Tarjetas de memoria",
    downloadPdf: "Descargar PDF (materiales)",
    openMiro: "Pizarra Miro",
    noLyrics: "La letra aún no está disponible",
    noTasks: "No hay ejercicios",
    noVocab: "El vocabulario aún no está disponible",
    noFlashcards: "No hay tarjetas",
    checkAnswer: "Comprobar",
    correct: "✅ ¡Correcto!",
    incorrect: "❌ Incorrecto",
    showTranslation: "Mostrar traducción",
    hideTranslation: "Ocultar traducción",
    liveTasksOn: "Ejercicios en vivo activados",
    liveTasksOff: "Ejercicios en vivo desactivados",
    highlightOn: "Resaltado de letra activado",
    highlightOff: "Resaltado de letra desactivado",
    translationsOn: "Traducciones mostradas",
    translationsOff: "Traducciones ocultadas",
  }
};

// Текущий язык (берём из localStorage, как в каталоге)
const currentLang = localStorage.getItem("lang") || "es";

// Функция перевода
function t(key) {
  return i18nSong[currentLang]?.[key] || i18nSong.ru[key] || key;
}
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
  return (str ?? '').toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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

  // Переключатели
  const toggleLive = document.getElementById('toggle-live');
  if (toggleLive) toggleLive.addEventListener('change', (e) => toggleLiveTasks(e.target.checked));
  const toggleHighlight = document.getElementById('toggle-highlight');
  if (toggleHighlight) toggleHighlight.addEventListener('change', (e) => toggleLyricsHighlight(e.target.checked));
  const toggleTrans = document.getElementById('toggle-translations');
  if (toggleTrans) toggleTrans.addEventListener('change', (e) => toggleTranslations(e.target.checked));
});

function renderSong(song) {
  const titleEl = $('song-title');
  if (titleEl) titleEl.textContent = safeText(song.title);
  const artistEl = $('song-artist');
  if (artistEl) artistEl.textContent = song.artist || '';

  renderLyrics(song.lyrics);
  renderTasks(song.tasks);
  renderVocabulary(song.vocabulary);
  
  // НОВОЕ: рендерим грамматические правила
  renderGrammarRules(song.grammarRules);

  liveTasks = song.liveTasks || [];
  completedLiveTasks.clear();

  const flashcardTask = (song.tasks || []).find(t => t.type === 'flashcards');
  console.log('🔍 Найденное задание flashcards:', flashcardTask);
  renderFlashcards(flashcardTask ? flashcardTask.flashcards : null);
  renderBadges(song);

  // Ресурсы (PDF, Miro) под видео
  const resourcesContainer = document.getElementById('song-resources');
  if (resourcesContainer) {
    resourcesContainer.innerHTML = '';
    if (song.pdf && song.pdf.trim() !== '') {
      const pdfLink = document.createElement('a');
      pdfLink.href = song.pdf;
      pdfLink.className = 'resource-link pdf';
      pdfLink.target = '_blank';
      pdfLink.innerHTML = '<i class="fas fa-file-pdf"></i> Скачать PDF (материалы)';
      resourcesContainer.appendChild(pdfLink);
    }
    if (song.miro && song.miro.trim() !== '') {
      const miroLink = document.createElement('a');
      miroLink.href = song.miro;
      miroLink.className = 'resource-link miro';
      miroLink.target = '_blank';
      miroLink.innerHTML = '<i class="fab fa-miro"></i> Доска Miro';
      resourcesContainer.appendChild(miroLink);
    }
  }

  const contentEl = $('song-content');
  if (contentEl) contentEl.style.display = '';

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
    html += `<div class="lyric-block">`;
    html += `<p class="lyric-line" data-index="${index}" data-time="${line.time || ''}">${escapeHtml(line.text)}</p>`;
    if (line.translation) {
      html += `<p class="lyric-translation" style="display: ${translationsVisible ? 'block' : 'none'};">${escapeHtml(line.translation)}</p>`;
    }
    html += `</div>`;
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

// ===== НОВАЯ ФУНКЦИЯ: отображение грамматических правил =====
function renderGrammarRules(rules) {
  const container = document.getElementById('grammar-rules-content');
  if (!container) return;
  
  if (!rules || rules.trim() === '') {
    container.innerHTML = '<p class="muted">Грамматические правила для этой песни пока не добавлены.</p>';
    return;
  }
  
  // Разбиваем текст на абзацы для лучшего форматирования
  const paragraphs = rules.split('\n').filter(p => p.trim() !== '');
  
  let html = '';
  paragraphs.forEach(p => {
    html += `<p>${escapeHtml(p)}</p>`;
  });
  
  container.innerHTML = html;
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

  const listDiv = document.createElement('div');
  listDiv.className = 'tasks-list';

  tasks.forEach((task, index) => {
    if (task.type === 'flashcards') return; // flashcards обрабатываются отдельно

    const card = document.createElement('div');
    card.className = 'task-card';

    // Верхняя часть с заголовком и типом
    const top = document.createElement('div');
    top.className = 'task-top';

    const title = document.createElement('h4');
    title.className = 'task-title';
    title.textContent = safeText(task.title) || `Задание ${index + 1}`;

    const typeSpan = document.createElement('span');
    typeSpan.className = 'task-type';
    typeSpan.textContent = task.type || 'задание';

    top.appendChild(title);
    top.appendChild(typeSpan);
    card.appendChild(top);

    // Инструкция, если есть
    if (task.instruction && (task.instruction.ru || task.instruction.es)) {
      const instr = document.createElement('div');
      instr.className = 'task-instruction';
      instr.innerHTML = `<i class="fas fa-info-circle"></i> ${escapeHtml(safeText(task.instruction))}`;
      card.appendChild(instr);
    }

    // Тело задания
    const body = document.createElement('div');
    body.className = 'task-body';

    if (task.type === 'gapfill') renderGapFill(body, task);
    else if (task.type === 'quiz') renderQuiz(body, task);
    else if (task.type === 'match') renderMatchTask(body, task);
    else if (task.type === 'grammar') renderGrammarTask(body, task);
    else renderDefault(body, task);

    card.appendChild(body);
    listDiv.appendChild(card);
  });

  container.appendChild(listDiv);
}

function renderDefault(container, task) {
  if (task.content) {
    const p = document.createElement('p');
    p.textContent = task.content;
    container.appendChild(p);
  }
  if (task.wordBank && task.wordBank.length) {
    const bankDiv = document.createElement('div');
    bankDiv.className = 'word-bank';
    bankDiv.innerHTML = '<strong>Слова:</strong> ' + task.wordBank.map(w => `<span class="chip">${escapeHtml(w)}</span>`).join('');
    container.appendChild(bankDiv);
  }
}

function renderGrammarTask(container, task) {
  if (task.grammarRules) {
    const rulesDiv = document.createElement('div');
    rulesDiv.className = 'grammar-rules';
    rulesDiv.innerHTML = `<strong>📘 Правило:</strong> ${escapeHtml(task.grammarRules)}`;
    container.appendChild(rulesDiv);
  }
  if (task.content) {
    const p = document.createElement('p');
    p.textContent = task.content;
    container.appendChild(p);
  }
  if (task.wordBank && task.wordBank.length) {
    const bankDiv = document.createElement('div');
    bankDiv.className = 'word-bank';
    bankDiv.innerHTML = '<strong>Слова:</strong> ' + task.wordBank.map(w => `<span class="chip">${escapeHtml(w)}</span>`).join('');
    container.appendChild(bankDiv);
  }
}

function renderGapFill(container, task) {
  if (!task.text) return;

  const parts = task.text.split('___');
  const answers = task.answers || [];
  const options = task.options || [];

  const form = document.createElement('div');
  form.className = 'gap-fill-form';

  parts.forEach((part, idx) => {
    if (part) {
      const span = document.createElement('span');
      span.textContent = part;
      form.appendChild(span);
    }
    if (idx < parts.length - 1) {
      if (options[idx] && Array.isArray(options[idx])) {
        const select = document.createElement('select');
        select.className = 'gap-select';
        const def = document.createElement('option');
        def.textContent = '...';
        select.appendChild(def);
        options[idx].forEach(opt => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          select.appendChild(o);
        });
        form.appendChild(select);
      } else {
        const input = document.createElement('input');
        input.className = 'gap-input';
        input.placeholder = '...';
        form.appendChild(input);
      }
    }
  });

  container.appendChild(form);

  if (answers.length) {
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const btn = document.createElement('button');
    btn.className = 'task-btn primary';
    btn.textContent = 'Проверить';

    const res = document.createElement('div');
    res.className = 'task-answer';
    res.style.display = 'none';

    btn.onclick = () => {
      const inputs = form.querySelectorAll('.gap-input, .gap-select');
      let corr = 0;
      inputs.forEach((inp, i) => {
        if (inp.value.trim().toLowerCase() === answers[i].toLowerCase()) {
          inp.style.borderColor = 'green';
          corr++;
        } else {
          inp.style.borderColor = 'red';
        }
      });
      res.textContent = corr === answers.length ? '✅ Верно!' : `❌ Правильных: ${corr} из ${answers.length}`;
      res.style.display = 'block';
    };

    actions.appendChild(btn);
    actions.appendChild(res);
    container.appendChild(actions);
  }
}

function renderQuiz(container, task) {
  if (!task.questions) return;

  const form = document.createElement('div');

  task.questions.forEach((q, i) => {
    const div = document.createElement('div');
    div.className = 'quiz-question';
    div.innerHTML = `<p><strong>${q.question}</strong></p>`;

    q.options.forEach((opt, oi) => {
      const lbl = document.createElement('label');
      lbl.className = 'quiz-option';
      lbl.innerHTML = `<input type="radio" name="q_${i}" value="${oi}"> ${opt}`;
      div.appendChild(lbl);
    });

    form.appendChild(div);
  });

  container.appendChild(form);

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const btn = document.createElement('button');
  btn.className = 'task-btn primary';
  btn.textContent = 'Проверить';

  const res = document.createElement('div');
  res.className = 'task-answer';
  res.style.display = 'none';

  btn.onclick = () => {
    let corr = 0;
    task.questions.forEach((q, i) => {
      const sel = document.querySelector(`input[name="q_${i}"]:checked`);
      if (sel && +sel.value === q.correct) corr++;
    });
    res.textContent = corr === task.questions.length ? '✅ Верно!' : `❌ Правильных: ${corr} из ${task.questions.length}`;
    res.style.display = 'block';
  };

  actions.appendChild(btn);
  actions.appendChild(res);
  container.appendChild(actions);
}

function renderMatchTask(container, task) {
  if (!task.pairs) return;

  const leftItems = task.pairs.map((p, idx) => ({ text: p.left, id: idx }));
  const rightItems = task.pairs.map((p, idx) => ({ text: p.right, id: idx }));

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  shuffle(leftItems);
  shuffle(rightItems);

  const grid = document.createElement('div');
  grid.className = 'match-grid';

  const lCol = document.createElement('div');
  lCol.className = 'match-column';

  const rCol = document.createElement('div');
  rCol.className = 'match-column';

  let selectedId = null;
  const matched = new Set();

  leftItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'match-item';
    el.textContent = item.text;
    el.dataset.id = item.id;
    el.dataset.side = 'left';

    el.onclick = () => {
      if (matched.has(item.id)) return;
      if (selectedId === item.id) {
        el.classList.remove('selected');
        selectedId = null;
      } else {
        document.querySelectorAll('.match-item.selected').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        selectedId = item.id;
      }
    };

    lCol.appendChild(el);
  });

  rightItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'match-item';
    el.textContent = item.text;
    el.dataset.id = item.id;
    el.dataset.side = 'right';

    el.onclick = () => {
      if (matched.has(item.id)) return;
      if (selectedId !== null && selectedId === item.id) {
        const leftEl = document.querySelector(`.match-item[data-id="${item.id}"][data-side="left"]`);
        if (leftEl) {
          leftEl.classList.add('matched');
          leftEl.classList.remove('selected');
        }
        el.classList.add('matched');
        matched.add(item.id);
        selectedId = null;
      } else {
        el.style.backgroundColor = '#fee2e2';
        setTimeout(() => el.style.backgroundColor = '', 300);
      }
    };

    rCol.appendChild(el);
  });

  grid.appendChild(lCol);
  grid.appendChild(rCol);
  container.appendChild(grid);
}

// ===== Функция для карточек =====
function renderFlashcards(flashcards) {
  console.log('📇 renderFlashcards вызван, получено карточек:', flashcards ? flashcards.length : 0);
  const container = $('flashcard-wrapper');
  const emptyDiv = $('flashcards-empty');
  const counter = $('flashcards-counter');
  const prevBtn = $('flashcards-prev');
  const nextBtn = $('flashcards-next');
  const progressFill = $('flashcards-progress-fill');
  const progressText = $('flashcards-progress-text');
  const resetBtn = $('flashcards-reset');

  let actionsContainer = document.querySelector('.flashcards-actions');
  if (!actionsContainer) {
    const flashcardsContainer = document.querySelector('.flashcards-container');
    if (flashcardsContainer) {
      actionsContainer = document.createElement('div');
      actionsContainer.className = 'flashcards-actions';
      flashcardsContainer.appendChild(actionsContainer);
    }
  }

  const oldLearnBtn = document.getElementById('dynamic-learn-btn');
  if (oldLearnBtn) oldLearnBtn.remove();

  if (!flashcards || !flashcards.length) {
    console.log('❌ Карточек нет, показываем заглушку');
    if (emptyDiv) emptyDiv.style.display = 'block';
    if (container) container.innerHTML = '';
    if (counter) counter.textContent = '0/0';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0/0';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  console.log('✅ Карточки есть, начинаем рендер');
  if (emptyDiv) emptyDiv.style.display = 'none';

  let currentIndex = 0;
  let learned = new Array(flashcards.length).fill(false);

  const learnBtn = document.createElement('button');
  learnBtn.id = 'dynamic-learn-btn';
  learnBtn.className = 'flashcards-btn learn-toggle';
  learnBtn.style.minWidth = '120px';
  if (actionsContainer) {
    if (resetBtn) {
      actionsContainer.insertBefore(learnBtn, resetBtn);
    } else {
      actionsContainer.appendChild(learnBtn);
    }
  }

  function updateProgress() {
    if (!progressFill || !progressText) return;
    const learnedCount = learned.filter(v => v).length;
    const percent = (learnedCount / flashcards.length) * 100;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${learnedCount}/${flashcards.length}`;
  }

  function updateCard() {
    if (!container || !flashcards.length) return;
    const card = flashcards[currentIndex];
    const isLearned = learned[currentIndex];
    console.log(`🃏 Обновляем карточку ${currentIndex + 1}:`, card.es);

    container.innerHTML = `
      <div class="flashcard ${isLearned ? 'flashcard-learned' : ''}">
        <div class="flashcard-front">
          <div class="word">${escapeHtml(card.es || card.word || '')}</div>
          ${card.example ? `<div class="example">${escapeHtml(card.example)}</div>` : ''}
          ${card.transcription ? `<div class="transcription">${escapeHtml(card.transcription)}</div>` : ''}
          ${isLearned ? '<div class="learned-stamp"><i class="fas fa-check-circle"></i> Выучено</div>' : ''}
        </div>
        <div class="flashcard-back">
          <div class="translation">${escapeHtml(card.ru || card.translation || '')}</div>
          ${card.example_translation ? `<div class="example-translation">${escapeHtml(card.example_translation)}</div>` : ''}
        </div>
      </div>
    `;

    const flashcardEl = container.querySelector('.flashcard');
    if (flashcardEl) {
      flashcardEl.onclick = function (e) {
        this.classList.toggle('flipped');
      };
    }

    if (learnBtn) {
      learnBtn.innerHTML = `<i class="fas ${isLearned ? 'fa-times' : 'fa-check'}"></i> ${isLearned ? 'Не выучено' : '✓ Знаю'}`;
      learnBtn.className = `flashcards-btn learn-toggle ${isLearned ? 'danger' : ''}`;
      learnBtn.onclick = (e) => {
        e.stopPropagation();
        learned[currentIndex] = !learned[currentIndex];
        updateProgress();
        updateCard();
      };
    }

    if (counter) counter.textContent = `${currentIndex + 1}/${flashcards.length}`;
    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    if (nextBtn) nextBtn.disabled = currentIndex === flashcards.length - 1;
  }

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

  if (resetBtn) {
    resetBtn.onclick = () => {
      learned.fill(false);
      updateProgress();
      updateCard();
    };
  }

  updateProgress();
  updateCard();
}

// ===== Живые задания =====
function checkLiveTasks(currentTime) {
  if (!liveTasksEnabled) return;
  if (!liveTasks.length) return;
  const taskIndex = liveTasks.findIndex((t, idx) => t.time <= currentTime && !completedLiveTasks.has(idx));
  if (taskIndex === -1) return;

  const task = liveTasks[taskIndex];
  completedLiveTasks.add(taskIndex);
  showLiveTaskPopup(task);
}

function showLiveTaskPopup(task) {
  if (livePopup) livePopup.remove();

  const popup = document.createElement('div');
  popup.className = 'live-task-popup';
  popup.setAttribute('role', 'dialog');

  let content = '';
  if (task.type === 'word-catch') {
    content = `
      <h3>Какое слово ты услышал?</h3>
      <div class="live-options">
        ${task.options.map(opt => `<button class="live-option" data-value="${opt}">${opt}</button>`).join('')}
      </div>
    `;
  } else if (task.type === 'translate') {
    content = `
      <h3>Перевод слова "${task.word}":</h3>
      <div class="live-options">
        ${task.options.map(opt => `<button class="live-option" data-value="${opt}">${opt}</button>`).join('')}
      </div>
    `;
  } else if (task.type === 'gapfill') {
    content = `
      <h3>Вставь пропущенное слово:</h3>
      <p class="gap-line">${task.line.replace('___', '______')}</p>
      <div class="live-options">
        ${task.options.map(opt => `<button class="live-option" data-value="${opt}">${opt}</button>`).join('')}
      </div>
    `;
  }

  popup.innerHTML = `
    <div class="live-task-content">
      ${content}
      <button class="live-close-btn">✕</button>
    </div>
  `;

  popup.querySelectorAll('.live-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const selected = e.target.dataset.value;
      const isCorrect = (selected === task.correct);
      showFeedback(isCorrect, task.correct);
      popup.remove();
      livePopup = null;
    });
  });

  popup.querySelector('.live-close-btn').addEventListener('click', () => {
    popup.remove();
    livePopup = null;
  });

  document.body.appendChild(popup);
  livePopup = popup;
}

function showFeedback(isCorrect, correctAnswer) {
  const feedback = document.createElement('div');
  feedback.className = `live-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
  feedback.textContent = isCorrect ? '✅ Верно!' : `❌ Неверно. Правильный ответ: ${correctAnswer}`;
  document.body.appendChild(feedback);
  setTimeout(() => feedback.remove(), 2000);
}

function toggleLiveTasks(enable) {
  liveTasksEnabled = enable;
  showToast(enable ? 'Живые задания включены' : 'Живые задания отключены');
}

function toggleLyricsHighlight(enable) {
  lyricsHighlightEnabled = enable;
  if (!enable) {
    document.querySelectorAll('.lyric-line.active').forEach(el => el.classList.remove('active'));
  }
  showToast(enable ? 'Подсветка текста включена' : 'Подсветка текста отключена');
}

function toggleTranslations(show) {
  translationsVisible = show;
  const transEls = document.querySelectorAll('.lyric-translation');
  transEls.forEach(el => {
    el.style.display = show ? 'block' : 'none';
  });
  showToast(show ? 'Переводы показаны' : 'Переводы скрыты');
}

// ===== YouTube =====
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
  try {
    const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    if (d && d.event === 'infoDelivery' && d.info && typeof d.info.currentTime === 'number') ytLastTime = d.info.currentTime;
  } catch {}
});

function startSyncInterval() {
  if (syncInterval) clearInterval(syncInterval);
  if (!currentSong.lyrics) return;
  syncInterval = setInterval(() => {
    highlightCurrentLyric(ytLastTime * 1000);
    checkLiveTasks(ytLastTime);
  }, 200);
}

function parseTimeToMs(time) {
  if (!time) return 0;
  const parts = time.toString().split(':');
  if (parts.length === 2) return (parseInt(parts[0]) * 60 + parseFloat(parts[1].replace(',', '.'))) * 1000;
  return 0;
}

function highlightCurrentLyric(timeMs) {
  if (!lyricsHighlightEnabled) return;
  if (!currentSong.lyrics) return;
  let activeIndex = -1;
  for (let i = 0; i < currentSong.lyrics.length; i++) {
    const t = parseTimeToMs(currentSong.lyrics[i].time);
    if (t <= timeMs && t > 0) activeIndex = i;
    else if (t > timeMs) break;
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
      if (ms > 0) player.seekTo(ms / 1000, true);
    };
  });
}

