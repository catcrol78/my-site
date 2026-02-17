// song.js — ES5-совместимая версия (без шаблонных строк и стрелочных функций)
console.log("🎵 song.js загружен (ES5-совместимая версия)");

// ===== Глобальные переменные =====
var ytIframe = null;
var ytLastTime = 0;
var syncInterval = null;
var currentSong = null;
var ytFallbackTimer = null;

// Эмуляция объекта player
var player = {
  getCurrentTime: function() { return ytLastTime; },
  seekTo: function(seconds, allowSeekAhead) {
    if (ytIframe && ytIframe.contentWindow) {
      ytPost({ event: 'command', func: 'seekTo', args: [seconds, allowSeekAhead] });
    }
  },
  playVideo: function() {
    if (ytIframe && ytIframe.contentWindow) {
      ytPost({ event: 'command', func: 'playVideo', args: [] });
    }
  }
};

// ===== Вспомогательные функции =====
function $(id) { return document.getElementById(id); }

function hideLoader() {
  var loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
}

function safeText(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj.ru || obj.es || '';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, duration) {
  if (!duration) duration = 3000;
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, duration);
}

// ===== Получение ID песни из URL =====
var urlParams = new URLSearchParams(window.location.search);
var songId = parseInt(urlParams.get('id'));

// ===== Загрузка данных и отрисовка =====
document.addEventListener('DOMContentLoaded', function() {
  console.log("📅 DOM загружен, ищем песню с ID:", songId);
  
  if (typeof songsDataFromExternal === 'undefined') {
    showError('Данные не загружены. Файл songs-data.js не найден или содержит ошибку.');
    return;
  }
  
  var song = null;
  for (var i = 0; i < songsDataFromExternal.length; i++) {
    if (songsDataFromExternal[i].id === songId) {
      song = songsDataFromExternal[i];
      break;
    }
  }
  
  if (!song) {
    showError('Песня с ID ' + songId + ' не найдена в базе.');
    return;
  }
  
  console.log("✅ Песня найдена:", song);
  currentSong = song;
  renderSong(song);
});

// ===== Функция для отображения ошибки =====
function showError(message) {
  hideLoader();
  var notFoundDiv = $('not-found');
  if (notFoundDiv) {
    notFoundDiv.style.display = 'block';
    notFoundDiv.innerHTML = '<i class="fas fa-exclamation-triangle" style="font-size: 60px; color: #ef4444; margin-bottom: 20px;"></i>' +
      '<h2>Ошибка</h2>' +
      '<p>' + message + '</p>' +
      '<a href="index.html" class="back-link" style="display: inline-flex; align-items: center; gap: 8px; margin-top: 20px; padding: 10px 16px; background: white; border: 1px solid #e5e7eb; border-radius: 30px; text-decoration: none; color: #0f172a;">' +
      '<i class="fas fa-arrow-left"></i> Вернуться в каталог' +
      '</a>';
  } else {
    alert(message);
  }
}

// ===== Отрисовка страницы песни =====
function renderSong(song) {
  $('song-title').textContent = safeText(song.title);
  $('song-artist').textContent = song.artist || '';
  
  renderLyrics(song.lyrics);
  renderTasks(song.tasks);
  renderVocabulary(song.vocabulary);
  
  // Карточки
  var flashcardTask = null;
  if (song.tasks) {
    for (var i = 0; i < song.tasks.length; i++) {
      if (song.tasks[i].type === 'flashcards') {
        flashcardTask = song.tasks[i];
        break;
      }
    }
  }
  var flashcards = flashcardTask ? flashcardTask.flashcards : null;
  renderFlashcards(flashcards);
  
  renderBadges(song);
  
  $('song-content').style.display = 'block';
  hideLoader();
  setupTabs();
  
  if (song.youtubeId) {
    initPlayerPostMessage();
  }
}

// ===== Настройка вкладок =====
function setupTabs() {
  var tabs = document.querySelectorAll('.detail-tab');
  var panels = document.querySelectorAll('.detail-panel');
  
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', (function(tab) {
      return function() {
        var tabName = tab.dataset.tab;
        for (var j = 0; j < tabs.length; j++) {
          tabs[j].classList.remove('active');
          tabs[j].setAttribute('aria-selected', 'false');
        }
        for (var j = 0; j < panels.length; j++) {
          panels[j].classList.remove('active');
        }
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        var activePanel = document.querySelector('[data-panel="' + tabName + '"]');
        if (activePanel) activePanel.classList.add('active');
      };
    })(tabs[i]));
  }
}

// ===== Отрисовка текста песни =====
function renderLyrics(lyrics) {
  var container = $('lyrics-content');
  if (!lyrics || !lyrics.length) {
    container.innerHTML = '<p class="muted">Текст пока не добавлен</p>';
    return;
  }
  
  var html = '';
  for (var i = 0; i < lyrics.length; i++) {
    var line = lyrics[i];
    html += '<p class="lyric-line" data-index="' + i + '" data-time="' + (line.time || '') + '">' + escapeHtml(line.text) + '</p>';
  }
  container.innerHTML = html;
  
  setTimeout(makeLyricsClickable, 100);
}

// ===== Отрисовка лексики =====
function renderVocabulary(vocab) {
  var container = $('vocab-content');
  if (!vocab || !vocab.length) {
    container.innerHTML = '<p class="muted">Лексика пока не добавлена</p>';
    return;
  }
  var chips = [];
  for (var i = 0; i < vocab.length; i++) {
    chips.push('<span class="chip">' + escapeHtml(vocab[i]) + '</span>');
  }
  container.innerHTML = chips.join('');
}

// ===== Отрисовка бейджей =====
function renderBadges(song) {
  var badgesDiv = $('song-badges');
  var badges = [];
  if (song.level && song.level.length) {
    badges.push('<span class="badge"><i class="fas fa-signal"></i> ' + song.level.join(', ') + '</span>');
  }
  if (song.themes) {
    for (var i = 0; i < song.themes.length; i++) {
      badges.push('<span class="badge"><i class="fas fa-tag"></i> ' + escapeHtml(song.themes[i]) + '</span>');
    }
  }
  if (song.grammar) {
    for (var i = 0; i < song.grammar.length; i++) {
      badges.push('<span class="badge"><i class="fas fa-language"></i> ' + escapeHtml(song.grammar[i]) + '</span>');
    }
  }
  badgesDiv.innerHTML = badges.join('');
}

// ===== Отрисовка заданий (сокращённо, только нужное) =====
function renderTasks(tasks) {
  var container = $('tasks-container');
  if (!tasks || !tasks.length) {
    container.innerHTML = '<p class="muted">Заданий пока нет</p>';
    return;
  }
  container.innerHTML = '';
  for (var i = 0; i < tasks.length; i++) {
    var task = tasks[i];
    var taskDiv = document.createElement('div');
    taskDiv.className = 'task-block';
    taskDiv.dataset.taskIndex = i;

    var header = document.createElement('div');
    header.className = 'task-header';
    header.innerHTML = '<h3>' + (safeText(task.title) || ('Задание ' + (i+1))) + '</h3>' +
      '<span class="task-type-badge">' + (task.type || 'задание') + '</span>';
    taskDiv.appendChild(header);

    if (task.instruction) {
      var instr = document.createElement('div');
      instr.className = 'task-instruction';
      instr.innerHTML = '<i class="fas fa-info-circle"></i> ' + safeText(task.instruction);
      taskDiv.appendChild(instr);
    }

    var contentDiv = document.createElement('div');
    contentDiv.className = 'task-content';

    if (task.type === 'whackaword') {
      renderWhackaword(contentDiv, task);
    } else {
      // упрощённо для других типов
      if (task.content) {
        var p = document.createElement('p');
        p.textContent = task.content;
        contentDiv.appendChild(p);
      }
    }

    taskDiv.appendChild(contentDiv);
    container.appendChild(taskDiv);
  }
}

// ===== Карточки-перевёртыши (сокращённо) =====
function renderFlashcards(flashcards) {
  var container = $('flashcard-wrapper');
  var emptyDiv = $('flashcards-empty');
  var counterSpan = $('flashcards-counter');
  var prevBtn = $('flashcards-prev');
  var nextBtn = $('flashcards-next');
  var resetBtn = $('flashcards-reset');
  var progressFill = $('flashcards-progress-fill');
  var progressText = $('flashcards-progress-text');
  var badge = $('#flashcards-count');
  
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
  
  // Упрощённая версия без прогресса и переворота (для теста)
  container.innerHTML = '<p class="muted">Карточки загружены, но упрощённая версия не поддерживает интерактив. Используйте полную версию.</p>';
}

// ===== YouTube через iframe + postMessage =====
function ytPost(obj) {
  if (!ytIframe || !ytIframe.contentWindow) return;
  ytIframe.contentWindow.postMessage(JSON.stringify(obj), '*');
}

function initPlayerPostMessage() {
  if (!currentSong || !currentSong.youtubeId) return;

  ytIframe = document.getElementById('video-iframe');
  if (!ytIframe) return;

  var origin = encodeURIComponent(window.location.origin);
  var videoId = encodeURIComponent(currentSong.youtubeId);

  ytIframe.src = 'https://www.youtube.com/embed/' + videoId + '?enablejsapi=1&origin=' + origin + '&playsinline=1&rel=0';

  ytIframe.addEventListener('load', function() {
    console.log('📺 iframe загружен, запускаем синхронизацию');
    ytPost({ event: 'listening', id: 'yt1' });
    startSyncInterval();

    ytFallbackTimer = setTimeout(function() {
      if (ytLastTime === 0) {
        console.warn('⚠️ Нет сообщений от YouTube, возможно, видео не встраивается');
        showFallbackLink();
      }
    }, 5000);
  });
}

window.addEventListener('message', function(e) {
  if (!e || !e.data) return;

  var data;
  try {
    data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
  } catch (err) {
    return;
  }

  if (data && data.event === 'infoDelivery' && data.info && typeof data.info.currentTime === 'number') {
    ytLastTime = data.info.currentTime;
    if (ytFallbackTimer) {
      clearTimeout(ytFallbackTimer);
      ytFallbackTimer = null;
    }
  }
});

function showFallbackLink() {
  var videoContainer = document.querySelector('.video-container');
  if (!videoContainer) return;
  if (document.querySelector('.youtube-fallback-link')) return;

  var fallbackDiv = document.createElement('div');
  fallbackDiv.className = 'youtube-fallback-link';
  fallbackDiv.style.marginTop = '10px';
  fallbackDiv.style.textAlign = 'center';
  fallbackDiv.innerHTML = '<p style="color: #ef4444; margin-bottom: 5px;">⚠️ Видео не загружается через плеер</p>' +
    '<a href="https://www.youtube.com/watch?v=' + currentSong.youtubeId + '" target="_blank" class="open-youtube" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; background: #ff0000; color: white; border-radius: 30px; text-decoration: none;">' +
    '<i class="fab fa-youtube"></i> Открыть на YouTube' +
    '</a>';
  videoContainer.appendChild(fallbackDiv);
}

function startSyncInterval() {
  if (syncInterval) clearInterval(syncInterval);
  if (!currentSong || !hasTimestamps(currentSong)) {
    console.log("⏸️ У этой песни нет таймкодов, синхронизация не запущена");
    return;
  }
  console.log("⏱️ Запуск интервала синхронизации");
  syncInterval = setInterval(function() {
    if (player && player.getCurrentTime && currentSong) {
      var currentTimeSec = player.getCurrentTime();
      highlightCurrentLyric(currentTimeSec * 1000);
    }
  }, 100);
}

function hasTimestamps(song) {
  if (!song.lyrics) return false;
  for (var i = 0; i < song.lyrics.length; i++) {
    var line = song.lyrics[i];
    if (line.time && line.time.toString().trim() !== '') return true;
  }
  return false;
}

function parseTimeToMs(time) {
  if (!time) return 0;
  if (typeof time === 'number') return time * 1000;
  var parts = time.split(':');
  if (parts.length === 2) {
    var minutes = parseInt(parts[0], 10);
    var seconds = parseFloat(parts[1].replace(',', '.'));
    return (minutes * 60 + seconds) * 1000;
  }
  return 0;
}

function highlightCurrentLyric(timeMs) {
  var lyrics = currentSong.lyrics;
  if (!lyrics || !lyrics.length) return;

  var activeIndex = -1;
  for (var i = 0; i < lyrics.length; i++) {
    var lineTime = parseTimeToMs(lyrics[i].time);
    if (lineTime === 0 || isNaN(lineTime)) continue;
    if (lineTime <= timeMs) {
      activeIndex = i;
    } else {
      break;
    }
  }

  var lines = document.querySelectorAll('.lyric-line');
  for (var i = 0; i < lines.length; i++) {
    lines[i].classList.remove('active');
  }

  if (activeIndex >= 0 && lines[activeIndex]) {
    lines[activeIndex].classList.add('active');
  }
}

function makeLyricsClickable() {
  var lines = document.querySelectorAll('.lyric-line');
  for (var i = 0; i < lines.length; i++) {
    lines[i].addEventListener('click', (function(line) {
      return function() {
        var index = line.dataset.index;
        if (index && currentSong && currentSong.lyrics && currentSong.lyrics[index]) {
          var timeMs = parseTimeToMs(currentSong.lyrics[index].time);
          if (timeMs === 0 || isNaN(timeMs)) {
            showToast('У этой строки нет временной метки', 1500);
            return;
          }
          if (player && player.seekTo) {
            player.seekTo(timeMs / 1000, true);
            player.playVideo();
          } else {
            if (confirm('Видео не загружается. Открыть его на YouTube?')) {
              window.open('https://www.youtube.com/watch?v=' + currentSong.youtubeId, '_blank');
            }
          }
        }
      };
    })(lines[i]));
  }
}

// ===== Игра Whac-a-Word (упрощённая версия) =====
function renderWhackaword(container, task) {
  if (!task.words || task.words.length === 0) {
    container.innerHTML = '<p class="muted">Для этой игры не заданы слова</p>';
    return;
  }

  container.innerHTML = '<div class="whackaword-container">' +
    '<div class="game-header">' +
    '<div class="score">Счёт: <span id="whackaword-score">0</span> / ' + task.targetScore + '</div>' +
    '<div class="timer">Время: <span id="whackaword-timer">' + task.timeLimit + '</span>с</div>' +
    '</div>' +
    '<div class="game-area" id="whackaword-game-area"></div>' +
    '<button class="start-game-btn" id="start-whackaword">Начать игру</button>' +
    '<div class="game-message" id="whackaword-message"></div>' +
    '</div>';

  var startBtn = container.querySelector('#start-whackaword');
  var gameArea = container.querySelector('#whackaword-game-area');
  var scoreSpan = container.querySelector('#whackaword-score');
  var timerSpan = container.querySelector('#whackaword-timer');
  var messageDiv = container.querySelector('#whackaword-message');

  var score = 0;
  var timeLeft = task.timeLimit;
  var gameActive = false;
  var timerInterval = null;
  var wordInterval = null;

  startBtn.addEventListener('click', function() {
    if (timerInterval) clearInterval(timerInterval);
    if (wordInterval) clearInterval(wordInterval);
    gameArea.innerHTML = '';
    messageDiv.innerHTML = '';
    score = 0;
    timeLeft = task.timeLimit;
    scoreSpan.textContent = score;
    timerSpan.textContent = timeLeft;
    gameActive = true;

    if (task.musicStartTime > 0 && player && player.seekTo) {
      player.seekTo(task.musicStartTime, true);
      player.playVideo();
    }

    timerInterval = setInterval(function() {
      if (!gameActive) return;
      timeLeft--;
      timerSpan.textContent = timeLeft;
      if (timeLeft <= 0) {
        endGame(false);
      }
    }, 1000);

    wordInterval = setInterval(function() {
      if (!gameActive) return;
      createWord();
    }, 800);
  });

  function createWord() {
    if (!gameActive) return;

    var randomIndex = Math.floor(Math.random() * task.words.length);
    var wordObj = task.words[randomIndex];

    var wordEl = document.createElement('div');
    wordEl.className = 'whackaword-word';
    wordEl.textContent = wordObj.text;
    wordEl.dataset.correct = wordObj.correct;
    wordEl.dataset.wordIndex = randomIndex;

    wordEl.style.left = Math.random() * 80 + '%';
    wordEl.style.top = Math.random() * 80 + '%';

    wordEl.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!gameActive) return;
      if (wordEl.classList.contains('clicked')) return;
      wordEl.classList.add('clicked');

      if (wordObj.correct) {
        score++;
        scoreSpan.textContent = score;
        showToast('✅ +1');
        if (score >= task.targetScore) {
          endGame(true);
        }
      } else {
        timeLeft = Math.max(0, timeLeft - 2);
        timerSpan.textContent = timeLeft;
        showToast('❌ -2 сек');
        if (timeLeft <= 0) {
          endGame(false);
        }
      }
      wordEl.remove();
    });

    setTimeout(function() {
      if (wordEl.parentNode && gameActive) {
        wordEl.remove();
      }
    }, 2000);

    gameArea.appendChild(wordEl);
  }

  function endGame(win) {
    gameActive = false;
    clearInterval(timerInterval);
    clearInterval(wordInterval);
    gameArea.innerHTML = '';

    if (win) {
      messageDiv.innerHTML = '<div class="win-message">🎉 Победа! Ты справился!</div>';
    } else {
      messageDiv.innerHTML = '<div class="lose-message">⏰ Время вышло. Попробуй ещё раз!</div>';
    }
  }
}
