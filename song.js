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

// Получаем ID из URL
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
});

// Функция вызывается автоматически, когда YouTube Iframe API готов
function onYouTubeIframeAPIReady() {
  // Плеер будет инициализирован после того, как iframe появится в DOM
  if (document.getElementById('video-iframe')) {
    initPlayer();
    // Если через 2 секунды плеер не создался, ставим src вручную (запасной вариант)
setTimeout(() => {
  const iframe = $('video-iframe');
  if (iframe && !iframe.src && song.youtubeId) {
    console.log("YouTube API не сработал, устанавливаем src вручную");
    iframe.src = `https://www.youtube.com/embed/${song.youtubeId}`;
  }
}, 2000);
  } else {
    // Если iframe ещё не загружен, подождём немного
    setTimeout(onYouTubeIframeAPIReady, 100);
  }
}

function initPlayer() {
  if (!currentSong || !currentSong.youtubeId) return;
  
  player = new YT.Player('video-iframe', {
    videoId: currentSong.youtubeId,
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerReady(event) {
  console.log("YouTube плеер готов");
  startSyncInterval();
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    startSyncInterval();
  } else {
    stopSyncInterval();
  }
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

// Проверяет, есть ли у песни хотя бы одна строка с временной меткой
function hasTimestamps(song) {
  return song.lyrics && song.lyrics.some(line => line.time && line.time.toString().trim() !== '');
}

// Преобразование времени из формата "мм:сс" или "мм:сс.сс" в миллисекунды
function parseTimeToMs(time) {
  if (!time) return 0;
  if (typeof time === 'number') return time * 1000; // если уже число (секунды)
  
  const parts = time.split(':');
  if (parts.length === 2) {
    const minutes = parseInt(parts[0]);
    const seconds = parseFloat(parts[1]);
    return (minutes * 60 + seconds) * 1000;
  }
  return 0;
}

// Подсветка текущей строки по времени
function highlightCurrentLyric(timeMs) {
  const lyrics = currentSong.lyrics;
  if (!lyrics || !lyrics.length) return;

  // Находим индекс последней строки с временем, которое <= текущему
  let activeIndex = -1;
  for (let i = 0; i < lyrics.length; i++) {
    const lineTime = parseTimeToMs(lyrics[i].time);
    // Пропускаем строки без времени – они не участвуют в синхронизации
    if (lineTime === 0 || isNaN(lineTime)) continue;
    
    if (lineTime <= timeMs) {
      activeIndex = i;
    } else {
      break; // строки идут по порядку, дальше можно не искать
    }
  }

  // Убираем класс active у всех строк
  document.querySelectorAll('.lyric-line').forEach(line => {
    line.classList.remove('active');
  });

  // Добавляем класс active найденной строке (если есть)
  if (activeIndex >= 0) {
    const activeLine = document.querySelector(`.lyric-line[data-index="${activeIndex}"]`);
    if (activeLine) {
      activeLine.classList.add('active');
      // Не прокручиваем автоматически, чтобы страница не прыгала
    }
  }
}

// Делаем строки кликабельными для перемотки
function makeLyricsClickable() {
  document.querySelectorAll('.lyric-line').forEach(line => {
    line.addEventListener('click', () => {
      const index = line.dataset.index;
      if (index && currentSong && currentSong.lyrics && currentSong.lyrics[index]) {
        const timeMs = parseTimeToMs(currentSong.lyrics[index].time);
        // Если у строки нет времени, клик ничего не делает
        if (timeMs === 0 || isNaN(timeMs)) {
          showToast('У этой строки нет временной метки', 1500);
          return;
        }
        if (player && player.seekTo) {
          player.seekTo(timeMs / 1000, true); // seekTo принимает секунды
          player.playVideo(); // можно сразу запустить воспроизведение
        }
      }
    });
  });
}

function showError(message) {
  hideLoader();
  const notFoundDiv = $('not-found');
  if (notFoundDiv) {
    notFoundDiv.style.display = 'block';
    notFoundDiv.innerHTML = `
      <i class="fas fa-exclamation-triangle" style="font-size: 60px; color: #ef4444; margin-bottom: 20px;"></i>
      <h2>Ошибка</h2>
      <p>${message}</p>
      <a href="index.html" class="back-link" style="display: inline-flex; align-items: center; gap: 8px; margin-top: 20px; padding: 10px 16px; background: white; border: 1px solid #e5e7eb; border-radius: 30px; text-decoration: none; color: #0f172a;">
        <i class="fas fa-arrow-left"></i> Вернуться в каталог
      </a>
    `;
  } else {
    alert(message);
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
  
  // Бейджи
  renderBadges(song);
  
  // Показываем контент
  $('song-content').style.display = 'block';
  hideLoader();
  setupTabs();
  
  // Работа с видео
  if (song.youtubeId) {
    // Пытаемся использовать API
    if (window.YT && YT.Player) {
      initPlayer();
    }
    // Запасной вариант: если через 2 секунды iframe всё ещё пустой, ставим src вручную
    setTimeout(() => {
      const iframe = $('video-iframe');
      if (iframe && !iframe.src && song.youtubeId) {
        console.log("YouTube API не сработал, устанавливаем src вручную");
        iframe.src = `https://www.youtube.com/embed/${song.youtubeId}`;
      }
    }, 2000);
  }
}
function setupTabs() {
  const tabs = document.querySelectorAll('.detail-tab');
  const panels = document.querySelectorAll('.detail-panel');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      
      panels.forEach(p => {
        p.classList.remove('active');
      });
      
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      
      const activePanel = document.querySelector(`[data-panel="${tabName}"]`);
      if (activePanel) activePanel.classList.add('active');
    });
  });
}

function renderLyrics(lyrics) {
  const container = $('lyrics-content');
  if (!lyrics || !lyrics.length) {
    container.innerHTML = '<p class="muted">Текст пока не добавлен</p>';
    return;
  }
  
  let html = '';
  lyrics.forEach((line, index) => {
    html += `<p class="lyric-line" data-index="${index}" data-time="${line.time || ''}">${escapeHtml(line.text)}</p>`;
  });
  container.innerHTML = html;
  
  // После добавления строк в DOM делаем их кликабельными
  setTimeout(makeLyricsClickable, 100);
}

function renderVocabulary(vocab) {
  const container = $('vocab-content');
  if (!vocab || !vocab.length) {
    container.innerHTML = '<p class="muted">Лексика пока не добавлена</p>';
    return;
  }
  container.innerHTML = vocab.map(w => 
    `<span class="chip">${escapeHtml(w)}</span>`
  ).join('');
}

function renderBadges(song) {
  const badgesDiv = $('song-badges');
  const badges = [];
  if (song.level) badges.push(`<span class="badge"><i class="fas fa-signal"></i> ${song.level.join(', ')}</span>`);
  if (song.themes) song.themes.forEach(t => badges.push(`<span class="badge"><i class="fas fa-tag"></i> ${escapeHtml(t)}</span>`));
  if (song.grammar) song.grammar.forEach(g => badges.push(`<span class="badge"><i class="fas fa-language"></i> ${escapeHtml(g)}</span>`));
  badgesDiv.innerHTML = badges.join('');
}

// ===== Карточки-перевёртыши =====
function renderFlashcards(flashcards) {
  const container = $('flashcard-wrapper');
  const emptyDiv = $('flashcards-empty');
  const counterSpan = $('flashcards-counter');
  const prevBtn = $('flashcards-prev');
  const nextBtn = $('flashcards-next');
  const resetBtn = $('flashcards-reset');
  const progressFill = $('flashcards-progress-fill');
  const progressText = $('flashcards-progress-text');
  const badge = $('#flashcards-count');
  
  // Обновляем счётчик на вкладке
  if (badge) {
    if (flashcards && flashcards.length) {
      badge.textContent = flashcards.length;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }
  
  if (!flashcards || !flashcards.length) {
    if (emptyDiv) emptyDiv.style.display = 'block';
    if (container) container.innerHTML = '';
    if (counterSpan) counterSpan.textContent = '0 / 0';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0/0';
    return;
  }
  
  if (emptyDiv) emptyDiv.style.display = 'none';
  
  // Состояние
  let currentIndex = 0;
  let learnedCards = loadProgress(songId, flashcards.length);
  
  // Обновляем интерфейс
  updateCard();
  updateProgress();
  
  // Обработчики
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentIndex > 0) {
        currentIndex--;
        updateCard();
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentIndex < flashcards.length - 1) {
        currentIndex++;
        updateCard();
      }
    });
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Сбросить прогресс по всем карточкам?')) {
        learnedCards = new Set();
        saveProgress(songId, learnedCards);
        updateCard();
        updateProgress();
        showToast('Прогресс сброшен');
      }
    });
  }
  
  // Функция обновления карточки
  function updateCard() {
    const card = flashcards[currentIndex];
    
    // Проверяем, выучена ли карточка
    const isLearned = learnedCards.has(currentIndex);
    
    // Генерируем HTML карточки
    container.innerHTML = `
      <div class="flashcard ${isLearned ? 'flashcard-learned' : ''}" data-index="${currentIndex}">
        <div class="flashcard-front">
          <div class="word">${escapeHtml(card.es || card.word || '')}</div>
          ${card.transcription ? `<div class="transcription">${escapeHtml(card.transcription)}</div>` : ''}
          ${isLearned ? '<div class="learned-stamp"><i class="fas fa-check"></i> Выучено</div>' : ''}
        </div>
        <div class="flashcard-back">
          <div class="translation">${escapeHtml(card.ru || card.translation || '')}</div>
          ${card.example ? `<div class="example">${escapeHtml(card.example)}</div>` : ''}
          ${card.example_translation ? `<div class="example-translation">${escapeHtml(card.example_translation)}</div>` : ''}
          ${!isLearned ? `
            <button class="flashcards-btn mark-learned" data-index="${currentIndex}">
              <i class="fas fa-check"></i> Я выучил(а)
            </button>
          ` : `
            <div class="learned-badge">
              <i class="fas fa-check-circle"></i> Выучено
            </div>
          `}
        </div>
      </div>
    `;
    
    // Добавляем обработчик переворота
    const flashcard = container.querySelector('.flashcard');
    if (flashcard) {
      flashcard.addEventListener('click', (e) => {
        // Не переворачиваем, если клик по кнопке
        if (e.target.closest('.mark-learned')) return;
        flashcard.classList.toggle('flipped');
      });
    }
    
    // Обработчик кнопки "Я выучил(а)"
    const markBtn = container.querySelector('.mark-learned');
    if (markBtn) {
      markBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(markBtn.dataset.index);
        learnedCards.add(idx);
        saveProgress(songId, learnedCards);
        updateCard();
        updateProgress();
        showToast('🎉 Отлично! Слово добавлено в выученные');
      });
    }
    
    // Обновляем счётчик
    if (counterSpan) {
      counterSpan.textContent = `${currentIndex + 1} / ${flashcards.length}`;
    }
    
    // Обновляем состояние кнопок навигации
    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    if (nextBtn) nextBtn.disabled = currentIndex === flashcards.length - 1;
  }
  
  // Функция обновления прогресс-бара
  function updateProgress() {
    const percent = Math.round((learnedCards.size / flashcards.length) * 100);
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${learnedCards.size}/${flashcards.length}`;
  }
  
  // Загрузка прогресса из localStorage
  function loadProgress(songId, total) {
    const key = `flashcards_${songId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        return new Set(data.learned || []);
      }
    } catch (e) {
      console.error('Ошибка загрузки прогресса:', e);
    }
    return new Set();
  }
  
  // Сохранение прогресса в localStorage
  function saveProgress(songId, learnedSet) {
    const key = `flashcards_${songId}`;
    const data = {
      learned: Array.from(learnedSet),
      updated: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(data));
  }
}

// ===== Отрисовка заданий =====
function renderTasks(tasks) {
  const container = $('tasks-container');
  if (!tasks || !tasks.length) {
    container.innerHTML = '<p class="muted">Заданий пока нет</p>';
    return;
  }

  container.innerHTML = '';
  tasks.forEach((task, index) => {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-block';
    taskDiv.dataset.taskIndex = index;

    const header = document.createElement('div');
    header.className = 'task-header';
    header.innerHTML = `
      <h3>${safeText(task.title) || `Задание ${index + 1}`}</h3>
      <span class="task-type-badge">${task.type || 'задание'}</span>
    `;
    taskDiv.appendChild(header);

    if (task.instruction) {
      const instr = document.createElement('div');
      instr.className = 'task-instruction';
      instr.innerHTML = `<i class="fas fa-info-circle"></i> ${safeText(task.instruction)}`;
      taskDiv.appendChild(instr);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'task-content';

    switch (task.type) {
      case 'gapfill':
        renderGapFill(contentDiv, task);
        break;
      case 'quiz':
        renderQuiz(contentDiv, task);
        break;
      case 'match':
        renderMatchTask(contentDiv, task);
        break;
      default:
        renderDefault(contentDiv, task);
    }

    taskDiv.appendChild(contentDiv);
    container.appendChild(taskDiv);
  });
}

// Задание по умолчанию (простой текст)
function renderDefault(container, task) {
  if (task.content) {
    const p = document.createElement('p');
    p.textContent = task.content;
    container.appendChild(p);
  }
  if (task.wordBank) {
    const bankDiv = document.createElement('div');
    bankDiv.className = 'word-bank';
    bankDiv.innerHTML = '<strong>Слова для справки:</strong> ' + 
      task.wordBank.map(w => `<span class="chip">${escapeHtml(w)}</span>`).join('');
    container.appendChild(bankDiv);
  }
}

// Заполнение пропусков
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
        select.dataset.index = idx;
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '— выберите —';
        select.appendChild(defaultOption);
        options[idx].forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          select.appendChild(option);
        });
        form.appendChild(select);
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'gap-input';
        input.dataset.index = idx;
        input.placeholder = '...';
        form.appendChild(input);
      }
    }
  });

  container.appendChild(form);

  if (answers && answers.length) {
    const checkBtn = document.createElement('button');
    checkBtn.className = 'check-btn';
    checkBtn.textContent = 'Проверить';
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result-message';
    resultDiv.style.display = 'none';

    checkBtn.addEventListener('click', () => {
      const inputs = form.querySelectorAll('input.gap-input, select.gap-select');
      let correctCount = 0;
      inputs.forEach((input, i) => {
        const userAnswer = input.value.trim().toLowerCase();
        const correct = answers[i].toLowerCase();
        if (userAnswer === correct) {
          input.style.borderColor = 'green';
          correctCount++;
        } else {
          input.style.borderColor = 'red';
        }
      });

      if (correctCount === answers.length) {
        resultDiv.textContent = '✅ Всё верно! Молодец!';
        resultDiv.className = 'result-message correct';
      } else {
        resultDiv.textContent = `❌ Правильно ${correctCount} из ${answers.length}`;
        resultDiv.className = 'result-message incorrect';
      }
      resultDiv.style.display = 'block';
    });

    container.appendChild(checkBtn);
    container.appendChild(resultDiv);
  }
}

// Викторина с выбором ответа
function renderQuiz(container, task) {
  if (!task.questions) return;

  const form = document.createElement('div');
  form.className = 'quiz-form';

  task.questions.forEach((q, qIdx) => {
    const questionDiv = document.createElement('div');
    questionDiv.className = 'quiz-question';
    questionDiv.innerHTML = `<p><strong>${q.question}</strong></p>`;

    q.options.forEach((opt, optIdx) => {
      const label = document.createElement('label');
      label.className = 'quiz-option';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `q_${qIdx}`;
      radio.value = optIdx;
      label.appendChild(radio);
      label.appendChild(document.createTextNode(' ' + opt));
      questionDiv.appendChild(label);
    });

    form.appendChild(questionDiv);
  });

  container.appendChild(form);

  const checkBtn = document.createElement('button');
  checkBtn.className = 'check-btn';
  checkBtn.textContent = 'Проверить';
  const resultDiv = document.createElement('div');
  resultDiv.className = 'result-message';
  resultDiv.style.display = 'none';

  checkBtn.addEventListener('click', () => {
    let correctCount = 0;
    task.questions.forEach((q, qIdx) => {
      const selected = document.querySelector(`input[name="q_${qIdx}"]:checked`);
      if (selected && parseInt(selected.value) === q.correct) {
        correctCount++;
      }
    });

    if (correctCount === task.questions.length) {
      resultDiv.textContent = '✅ Все ответы верны!';
      resultDiv.className = 'result-message correct';
    } else {
      resultDiv.textContent = `❌ Правильно ${correctCount} из ${task.questions.length}`;
      resultDiv.className = 'result-message incorrect';
    }
    resultDiv.style.display = 'block';
  });

  container.appendChild(checkBtn);
  container.appendChild(resultDiv);
}

// Сопоставление (match)
function renderMatchTask(container, task) {
  if (!task.pairs || !task.pairs.length) return;

  const grid = document.createElement('div');
  grid.className = 'match-grid';

  const leftCol = document.createElement('div');
  leftCol.className = 'match-column';
  leftCol.innerHTML = '<h4 style="margin-top:0;">Испанский</h4>';

  const rightCol = document.createElement('div');
  rightCol.className = 'match-column';
  rightCol.innerHTML = '<h4 style="margin-top:0;">Русский</h4>';

  const matchedPairs = new Set();
  let selectedLeft = null;

  task.pairs.forEach((pair, idx) => {
    // Левый элемент
    const leftItem = document.createElement('div');
    leftItem.className = 'match-item';
    leftItem.textContent = pair.left;
    leftItem.dataset.pairId = idx;
    leftItem.dataset.side = 'left';

    leftItem.addEventListener('click', () => {
      if (leftItem.classList.contains('matched')) return;

      if (selectedLeft === leftItem) {
        leftItem.classList.remove('selected');
        selectedLeft = null;
      } else {
        document.querySelectorAll('.match-item.selected').forEach(el => el.classList.remove('selected'));
        leftItem.classList.add('selected');
        selectedLeft = leftItem;
      }
    });

    // Правый элемент
    const rightItem = document.createElement('div');
    rightItem.className = 'match-item';
    rightItem.textContent = pair.right;
    rightItem.dataset.pairId = idx;
    rightItem.dataset.side = 'right';

    rightItem.addEventListener('click', () => {
      if (rightItem.classList.contains('matched')) return;

      if (selectedLeft) {
        const leftId = selectedLeft.dataset.pairId;
        if (leftId === String(idx)) {
          // Правильно
          selectedLeft.classList.add('matched');
          selectedLeft.classList.remove('selected');
          rightItem.classList.add('matched');
          matchedPairs.add(idx);

          if (matchedPairs.size === task.pairs.length) {
            showToast('🎉 Отлично! Все пары собраны!');
          }
        } else {
          // Неправильно
          showToast('Попробуйте другую пару', 1000);
        }
        selectedLeft = null;
      }
    });

    leftCol.appendChild(leftItem);
    rightCol.appendChild(rightItem);
  });

  grid.appendChild(leftCol);
  grid.appendChild(rightCol);
  container.appendChild(grid);
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

