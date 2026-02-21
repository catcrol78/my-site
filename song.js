// song.js — полная версия с переводом интерфейса (по умолчанию испанский)
console.log("🎵 song.js загружен (с i18n)");

// ===== i18n для страницы песни =====
const i18nSong = {
  ru: {
    tabLyrics: "Текст",
    tabTasks: "Задания",
    tabVocab: "Лексика",
    tabGrammar: "Грамматика",
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
    incorrectWithAnswer: "❌ Неверно. Правильный ответ: {answer}",
    showTranslation: "Показать перевод",
    hideTranslation: "Скрыть перевод",
    liveTasksOn: "Живые задания включены",
    liveTasksOff: "Живые задания отключены",
    highlightOn: "Подсветка текста включена",
    highlightOff: "Подсветка текста отключена",
    translationsOn: "Переводы показаны",
    translationsOff: "Переводы скрыты",
    learned: "Выучено",
    notLearned: "Не выучено",
    know: "✓ Знаю",
    wordCatchQuestion: "Какое слово ты услышал?",
    translateQuestion: "Перевод слова \"{word}\":",
    gapfillQuestion: "Вставь пропущенное слово:",
    close: "✕",
    grammarRule: "Грамматические правила",
    grammar: "Грамматика",
    liveTasks: "Живые задания",
    highlight: "Подсветка",
    translations: "Переводы",
    resetProgress: "Сбросить прогресс",
    noGrammarRules: "Грамматические правила не добавлены",
  },
  es: {
    tabLyrics: "Letra",
    tabTasks: "Ejercicios",
    tabVocab: "Vocabulario",
    tabGrammar: "Gramática",
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
    incorrectWithAnswer: "❌ Incorrecto. Respuesta correcta: {answer}",
    showTranslation: "Mostrar traducción",
    hideTranslation: "Ocultar traducción",
    liveTasksOn: "Ejercicios en vivo activados",
    liveTasksOff: "Ejercicios en vivo desactivados",
    highlightOn: "Resaltado de letra activado",
    highlightOff: "Resaltado de letra desactivado",
    translationsOn: "Traducciones mostradas",
    translationsOff: "Traducciones ocultadas",
    learned: "Aprendido",
    notLearned: "No aprendido",
    know: "✓ Saber",
    wordCatchQuestion: "¿Qué palabra escuchaste?",
    translateQuestion: "Traducción de \"{word}\":",
    gapfillQuestion: "Completa la palabra que falta:",
    close: "✕",
    grammarRule: "Reglas gramaticales",
    grammar: "Gramática",
    liveTasks: "Ejercicios en vivo",
    highlight: "Resaltado",
    translations: "Traducciones",
    resetProgress: "Reiniciar progreso",
    noGrammarRules: "No hay reglas gramaticales",
  }
};

// Текущий язык (по умолчанию испанский)
const currentLang = localStorage.getItem("lang") || "es";

// Функция перевода с поддержкой подстановок {key}
function t(key, params = {}) {
  let text = i18nSong[currentLang]?.[key] || i18nSong.ru[key] || key;
  if (params && typeof params === 'object') {
    for (let [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
  }
  return text;
}

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

// ===== Применение языка интерфейса =====
function applyInterfaceLanguage() {
  // Заголовки вкладок
  const tabMappings = {
    'lyrics': t('tabLyrics'),
    'tasks': t('tabTasks'),
    'vocab': t('tabVocab'),
    'grammar': t('tabGrammar'),
    'flashcards': t('tabFlashcards')
  };
  document.querySelectorAll('.detail-tab').forEach(tab => {
    const tabName = tab.dataset.tab;
    if (tabName && tabMappings[tabName]) {
      const span = tab.querySelector('span') || tab;
      span.textContent = tabMappings[tabName];
    }
  });

  // Заголовки панелей
  const lyricsHeader = document.querySelector('[data-panel="lyrics"] h3');
  if (lyricsHeader) lyricsHeader.innerHTML = `<i class="fas fa-file-alt"></i> ${t('lyricsHeader')}`;
  const tasksHeader = document.querySelector('[data-panel="tasks"] h3');
  if (tasksHeader) tasksHeader.innerHTML = `<i class="fas fa-tasks"></i> ${t('tasksHeader')}`;
  const vocabHeader = document.querySelector('[data-panel="vocab"] h3');
  if (vocabHeader) vocabHeader.innerHTML = `<i class="fas fa-language"></i> ${t('vocabHeader')}`;
  const grammarHeader = document.querySelector('[data-panel="grammar"] h3');
  if (grammarHeader) grammarHeader.innerHTML = `<i class="fas fa-book-open"></i> ${t('grammarRule')}`;
  const flashcardsHeader = document.querySelector('[data-panel="flashcards"] h3');
  if (flashcardsHeader) flashcardsHeader.innerHTML = `<i class="fas fa-layer-group"></i> ${t('flashcardsHeader')}`;

  // Ссылки на ресурсы
  const pdfLink = document.querySelector('.resource-link.pdf');
  if (pdfLink) pdfLink.innerHTML = `<i class="fas fa-file-pdf"></i> ${t('downloadPdf')}`;
  const miroLink = document.querySelector('.resource-link.miro');
  if (miroLink) miroLink.innerHTML = `<i class="fab fa-miro"></i> ${t('openMiro')}`;

  // Переключатели
  const toggleLiveLabel = document.querySelector('input#toggle-live')?.closest('label.control-toggle');
  if (toggleLiveLabel) {
    const checkbox = toggleLiveLabel.querySelector('input');
    if (checkbox) {
      toggleLiveLabel.innerHTML = '';
      toggleLiveLabel.appendChild(checkbox);
      toggleLiveLabel.appendChild(document.createTextNode(' ' + t('liveTasks')));
    }
  }
  const toggleHighlightLabel = document.querySelector('input#toggle-highlight')?.closest('label.control-toggle');
  if (toggleHighlightLabel) {
    const checkbox = toggleHighlightLabel.querySelector('input');
    if (checkbox) {
      toggleHighlightLabel.innerHTML = '';
      toggleHighlightLabel.appendChild(checkbox);
      toggleHighlightLabel.appendChild(document.createTextNode(' ' + t('highlight')));
    }
  }
  const toggleTransLabel = document.querySelector('input#toggle-translations')?.closest('label.control-toggle');
  if (toggleTransLabel) {
    const checkbox = toggleTransLabel.querySelector('input');
    if (checkbox) {
      toggleTransLabel.innerHTML = '';
      toggleTransLabel.appendChild(checkbox);
      toggleTransLabel.appendChild(document.createTextNode(' ' + t('translations')));
    }
  }
}

function renderSong(song) {
  const titleEl = $('song-title');
  if (titleEl) titleEl.textContent = safeText(song.title);
  const artistEl = $('song-artist');
  if (artistEl) artistEl.textContent = song.artist || '';

  renderLyrics(song.lyrics);
  renderTasks(song.tasks);
  renderVocabulary(song.vocabulary);
  renderGrammarRules(song.grammarRules);

  liveTasks = song.liveTasks || [];
  completedLiveTasks.clear();

  const flashcardTask = (song.tasks || []).find(t => t.type === 'flashcards');
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
      pdfLink.innerHTML = `<i class="fas fa-file-pdf"></i> ${t('downloadPdf')}`;
      resourcesContainer.appendChild(pdfLink);
    }
    if (song.miro && song.miro.trim() !== '') {
      const miroLink = document.createElement('a');
      miroLink.href = song.miro;
      miroLink.className = 'resource-link miro';
      miroLink.target = '_blank';
      miroLink.innerHTML = `<i class="fab fa-miro"></i> ${t('openMiro')}`;
      resourcesContainer.appendChild(miroLink);
    }
  }

  const contentEl = $('song-content');
  if (contentEl) contentEl.style.display = '';

  hideLoader();
  setupTabs();
  applyInterfaceLanguage(); // применяем перевод интерфейса
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
    container.innerHTML = `<p class="muted">${t('noLyrics')}</p>`;
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
    container.innerHTML = `<p class="muted">${t('noVocab')}</p>`;
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

// ===== ОТРИСОВКА ЗАДАНИЙ (без типа) =====
function renderTasks(tasks) {
  const container = $('tasks-container');
  if (!container) return;
  container.innerHTML = '';
  if (!tasks || !tasks.length) {
    container.innerHTML = `<p class="muted">${t('noTasks')}</p>`;
    return;
  }
  tasks.forEach((task, index) => {
    if (task.type === 'flashcards') return; // карточки обрабатываются отдельно
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-block';
    const header = document.createElement('div');
    header.className = 'task-header';
    // Убрано отображение типа задания
    header.innerHTML = `<h3>${safeText(task.title) || `${t('tasksHeader')} ${index + 1}`}</h3>`;
    taskDiv.appendChild(header);
    if (task.instruction) {
      const instr = document.createElement('div');
      instr.className = 'task-instruction';
      instr.innerHTML = `<i class="fas fa-info-circle"></i> ${safeText(task.instruction)}`;
      taskDiv.appendChild(instr);
    }
    const contentDiv = document.createElement('div');
    contentDiv.className = 'task-content';
    if (task.type === 'gapfill') renderGapFill(contentDiv, task);
    else if (task.type === 'quiz') renderQuiz(contentDiv, task);
    else if (task.type === 'match') renderMatchTask(contentDiv, task);
    else if (task.type === 'grammar') renderGrammarTask(contentDiv, task);
    else renderDefault(contentDiv, task);
    taskDiv.appendChild(contentDiv);
    container.appendChild(taskDiv);
  });
}

function renderDefault(container, task) {
  if (task.content) { const p = document.createElement('p'); p.textContent = task.content; container.appendChild(p); }
  if (task.wordBank) {
    const bankDiv = document.createElement('div'); bankDiv.className = 'word-bank';
    bankDiv.innerHTML = '<strong>' + (currentLang === 'es' ? 'Palabras:' : 'Слова:') + '</strong> ' + task.wordBank.map(w => `<span class="chip">${escapeHtml(w)}</span>`).join('');
    container.appendChild(bankDiv);
  }
}

function renderGrammarTask(container, task) {
  if (task.grammarRules) {
    const rulesDiv = document.createElement('div');
    rulesDiv.className = 'grammar-rules';
    rulesDiv.innerHTML = `<strong>📘 ${t('grammarRule')}:</strong> ${escapeHtml(task.grammarRules)}`;
    container.appendChild(rulesDiv);
  }
  if (task.content) {
    const p = document.createElement('p');
    p.textContent = task.content;
    container.appendChild(p);
  }
  if (task.wordBank && task.wordBank.length) {
    const bankDiv = document.createElement('div'); bankDiv.className = 'word-bank';
    bankDiv.innerHTML = '<strong>' + (currentLang === 'es' ? 'Palabras:' : 'Слова:') + '</strong> ' + task.wordBank.map(w => `<span class="chip">${escapeHtml(w)}</span>`).join('');
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
    const btn = document.createElement('button'); btn.className = 'check-btn'; btn.textContent = t('checkAnswer');
    const res = document.createElement('div'); res.className = 'result-message'; res.style.display = 'none';
    btn.onclick = () => {
      const inputs = form.querySelectorAll('.gap-input, .gap-select');
      let corr = 0;
      inputs.forEach((inp, i) => {
        if (inp.value.trim().toLowerCase() === answers[i].toLowerCase()) { inp.style.borderColor = 'green'; corr++; } else { inp.style.borderColor = 'red'; }
      });
      if (corr === answers.length) {
        res.textContent = t('correct');
        res.className = `result-message correct`;
      } else {
        res.textContent = t('incorrectWithAnswer', { answer: answers.join(', ') });
        res.className = `result-message incorrect`;
      }
      res.style.display = 'block';
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
  const btn = document.createElement('button'); btn.className = 'check-btn'; btn.textContent = t('checkAnswer');
  const res = document.createElement('div'); res.className = 'result-message'; res.style.display = 'none';
  btn.onclick = () => {
    let corr = 0;
    task.questions.forEach((q, i) => { const sel = document.querySelector(`input[name="q_${i}"]:checked`); if (sel && +sel.value === q.correct) corr++; });
    if (corr === task.questions.length) {
      res.textContent = t('correct');
      res.className = `result-message correct`;
    } else {
      res.textContent = t('incorrect');
      res.className = `result-message incorrect`;
    }
    res.style.display = 'block';
  };
  container.appendChild(btn); container.appendChild(res);
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

// ===== ФУНКЦИЯ ДЛЯ КАРТОЧЕК =====
function renderFlashcards(flashcards) {
  console.log('📇 renderFlashcards вызван, получено карточек:', flashcards ? flashcards.length : 0);
  const container = $('flashcard-wrapper');
  const emptyDiv = $('flashcards-empty');
  const counter = $('flashcards-counter');
  const prevBtn = $('flashcards-prev');
  const nextBtn = $('flashcards-next');
  const progressFill = $('flashcards-progress-fill');
  const progressText = $('flashcards-progress-text');
  const learnBtn = $('flashcards-learn');
  const resetBtn = $('flashcards-reset');

  if (!flashcards || !flashcards.length) {
    console.log('❌ Карточек нет, показываем заглушку');
    if (emptyDiv) {
      emptyDiv.style.display = 'block';
      emptyDiv.innerHTML = `<p class="muted">${t('noFlashcards')}</p>`;
    }
    if (container) container.innerHTML = '';
    if (counter) counter.textContent = '0/0';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0/0';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (learnBtn) learnBtn.style.display = 'none';
    if (resetBtn) resetBtn.style.display = 'none';
    return;
  }

  console.log('✅ Карточки есть, начинаем рендер');
  if (emptyDiv) emptyDiv.style.display = 'none';
  if (learnBtn) learnBtn.style.display = 'inline-flex';
  if (resetBtn) resetBtn.style.display = 'inline-flex';

  let currentIndex = 0;
  let learned = new Array(flashcards.length).fill(false);

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
          ${card.transcription ? `<div class="transcription">${escapeHtml(card.transcription)}</div>` : ''}
          ${card.example ? `<div class="example">${escapeHtml(card.example)}</div>` : ''}
          ${isLearned ? `<div class="learned-stamp"><i class="fas fa-check-circle"></i> ${t('learned')}</div>` : ''}
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
        if (e.target.closest('button')) return;
        this.classList.toggle('flipped');
      };
    }

    // Обновляем кнопку "Знаю"
    if (learnBtn) {
      learnBtn.innerHTML = isLearned
        ? `<i class="fas fa-times"></i> ${t('notLearned')}`
        : `<i class="fas fa-check"></i> ${t('know')}`;
      learnBtn.classList.toggle('danger', isLearned);
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

  // Обработчик для кнопки сброса
  if (resetBtn) {
    resetBtn.innerHTML = `<i class="fas fa-undo-alt"></i> ${t('resetProgress')}`;
    resetBtn.onclick = () => {
      learned.fill(false);
      updateProgress();
      updateCard();
    };
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
      <h3>${t('wordCatchQuestion')}</h3>
      <div class="live-options">
        ${task.options.map(opt => `<button class="live-option" data-value="${opt}">${opt}</button>`).join('')}
      </div>
    `;
  } else if (task.type === 'translate') {
    content = `
      <h3>${t('translateQuestion', { word: task.word })}</h3>
      <div class="live-options">
        ${task.options.map(opt => `<button class="live-option" data-value="${opt}">${opt}</button>`).join('')}
      </div>
    `;
  } else if (task.type === 'gapfill') {
    content = `
      <h3>${t('gapfillQuestion')}</h3>
      <p class="gap-line">${task.line.replace('___', '______')}</p>
      <div class="live-options">
        ${task.options.map(opt => `<button class="live-option" data-value="${opt}">${opt}</button>`).join('')}
      </div>
    `;
  }

  popup.innerHTML = `
    <div class="live-task-content">
      ${content}
      <button class="live-close-btn">${t('close')}</button>
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
  feedback.textContent = isCorrect ? t('correct') : t('incorrectWithAnswer', { answer: correctAnswer });
  document.body.appendChild(feedback);
  setTimeout(() => feedback.remove(), 2000);
}

function toggleLiveTasks(enable) {
  liveTasksEnabled = enable;
  showToast(enable ? t('liveTasksOn') : t('liveTasksOff'));
}

function toggleLyricsHighlight(enable) {
  lyricsHighlightEnabled = enable;
  if (!enable) {
    document.querySelectorAll('.lyric-line.active').forEach(el => el.classList.remove('active'));
  }
  showToast(enable ? t('highlightOn') : t('highlightOff'));
}

function toggleTranslations(show) {
  translationsVisible = show;
  const transEls = document.querySelectorAll('.lyric-translation');
  transEls.forEach(el => {
    el.style.display = show ? 'block' : 'none';
  });
  showToast(show ? t('translationsOn') : t('translationsOff'));
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
// ===== Отображение грамматических правил (с выбором языка) =====
function renderGrammarRules(grammarRules) {
  const container = document.getElementById('grammar-rules-content');
  if (!container) return;
  // Берём текст на текущем языке, если нет — на русском, иначе пусто
  const rulesText = grammarRules?.[currentLang] || grammarRules?.ru || '';
  if (!rulesText.trim()) {
    container.innerHTML = `<p class="muted">${t('noGrammarRules')}</p>`;
    return;
  }
  // Заменяем переносы строк на <br> для читаемости
  container.innerHTML = `<p>${escapeHtml(rulesText).replace(/\n/g, '<br>')}</p>`;
}
