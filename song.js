// song.js - Полноценная страница песни с интерактивными заданиями

// ===== Состояние =====
let currentLang = localStorage.getItem("lang") || "ru";
let currentSong = null;
let selectedMatchLeft = null;
let highlightedColor = null;

// ===== Вспомогательные функции =====
const $ = (id) => document.getElementById(id);

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.style.display = 'none', 300);
  }
}

function escapeHtml(str) {
  return (str ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(objOrString) {
  if (!objOrString) return "";
  if (typeof objOrString === "string") return objOrString;
  if (typeof objOrString === "object") return objOrString[currentLang] || objOrString.ru || objOrString.es || "";
  return "";
}

function youtubeEmbedUrl(youtubeId) {
  return youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : "";
}

function youtubeWatchUrl(youtubeId) {
  return youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : "#";
}

// ===== Получение ID песни из URL =====
function getSongIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  return id ? parseInt(id, 10) : null;
}

// ===== Загрузка песни =====
function loadSong() {
  const songId = getSongIdFromUrl();
  if (!songId) {
    showNotFound();
    return;
  }

  // Ищем песню в глобальном массиве
  const song = window.songsDataFromExternal?.find(s => s.id === songId);
  
  if (!song) {
    showNotFound();
    return;
  }

  currentSong = song;
  renderSong();
}

function showNotFound() {
  $('loader')?.classList.add('hidden');
  $('song-content').style.display = 'none';
  $('not-found').style.display = 'block';
}

// ===== Отрисовка песни =====
function renderSong() {
  if (!currentSong) return;

  // Заголовок и исполнитель
  $('song-title').textContent = safeText(currentSong.title);
  $('song-artist').textContent = currentSong.artist || '';

  // Бейджи
  renderBadges();

  // Видео
  const youtubeId = currentSong.youtubeId;
  $('video-iframe').src = youtubeEmbedUrl(youtubeId);
  $('youtube-link').href = youtubeWatchUrl(youtubeId);

  // PDF
  if (currentSong.pdf) {
    $('pdf-download').href = currentSong.pdf;
    $('pdf-download').style.display = 'inline-flex';
  } else {
    $('pdf-download').style.display = 'none';
  }

  // Текст песни
  renderLyrics();

  // Задания
  renderTasks();

  // Лексика
  renderVocabulary();

  // Культура
  renderCulture();

  // Грамматика
  renderGrammar();

  // Ограничения
  renderRestrictions();

  // Показываем контент
  $('song-content').style.display = 'block';
  hideLoader();
}

function renderBadges() {
  const badges = $('song-badges');
  badges.innerHTML = '';

  const items = [];

  // Уровень
  if (currentSong.level?.length) {
    items.push(`<span class="badge"><i class="fas fa-signal"></i> ${currentSong.level.join(', ')}</span>`);
  }

  // Темы
  if (currentSong.themes?.length) {
    currentSong.themes.forEach(theme => {
      items.push(`<span class="badge"><i class="fas fa-tag"></i> ${theme}</span>`);
    });
  }

  // Грамматика
  if (currentSong.grammar?.length) {
    currentSong.grammar.forEach(gram => {
      items.push(`<span class="badge"><i class="fas fa-language"></i> ${gram}</span>`);
    });
  }

  badges.innerHTML = items.join('');
}

function renderLyrics() {
  const container = $('lyrics-content');
  container.innerHTML = '';

  if (!currentSong.lyrics?.length) {
    container.innerHTML = '<p class="muted">Текст песни пока не добавлен</p>';
    return;
  }

  currentSong.lyrics.forEach(line => {
    const p = document.createElement('p');
    p.style.margin = '0 0 8px 0';
    p.style.lineHeight = '1.6';
    
    if (line.time) {
      const timeSpan = document.createElement('strong');
      timeSpan.style.marginRight = '10px';
      timeSpan.style.color = 'var(--accent)';
      timeSpan.textContent = line.time;
      p.appendChild(timeSpan);
    }
    
    // Разбиваем текст на слова для возможности выделения
    const words = (line.text || '').split(' ');
    words.forEach((word, idx) => {
      const span = document.createElement('span');
      span.className = 'word-highlight';
      span.textContent = word;
      span.setAttribute('data-word', word.toLowerCase().replace(/[.,!?;:]$/, ''));
      
      // Обработчик для выделения цветом
      span.addEventListener('click', () => {
        if (highlightedColor) {
          span.classList.toggle(highlightedColor);
        }
      });
      
      p.appendChild(span);
      if (idx < words.length - 1) {
        p.appendChild(document.createTextNode(' '));
      }
    });
    
    container.appendChild(p);
  });

  // Добавляем кнопки для выделения
  const highlightControls = document.createElement('div');
  highlightControls.style.marginTop = '20px';
  highlightControls.style.padding = '10px';
  highlightControls.style.background = '#f8fafc';
  highlightControls.style.borderRadius = '12px';
  
  highlightControls.innerHTML = `
    <p style="margin:0 0 10px 0; font-weight:500;">Выделить цветом:</p>
    <button class="highlight-btn" data-color="verb">Глаголы</button>
    <button class="highlight-btn" data-color="noun">Существительные</button>
    <button class="highlight-btn" data-color="adjective">Прилагательные</button>
    <button class="highlight-btn" data-color="">Сбросить</button>
  `;

  highlightControls.querySelectorAll('.highlight-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      
      // Убираем активный класс со всех кнопок
      highlightControls.querySelectorAll('.highlight-btn').forEach(b => {
        b.classList.remove('active');
      });
      
      if (color) {
        btn.classList.add('active');
        highlightedColor = color;
      } else {
        highlightedColor = null;
        // Сбрасываем все выделения
        container.querySelectorAll('.word-highlight').forEach(span => {
          span.classList.remove('verb', 'noun', 'adjective');
        });
      }
    });
  });

  container.appendChild(highlightControls);
}

function renderTasks() {
  const container = $('tasks-container');
  container.innerHTML = '';

  if (!currentSong.tasks?.length) {
    container.innerHTML = '<p class="muted">Для этой песни задания пока не добавлены</p>';
    return;
  }

  currentSong.tasks.forEach((task, index) => {
    const taskBlock = document.createElement('div');
    taskBlock.className = 'task-block';
    taskBlock.dataset.taskIndex = index;

    // Заголовок
    const header = document.createElement('div');
    header.className = 'task-header';
    header.innerHTML = `
      <h3>${safeText(task.title) || `Задание ${index + 1}`}</h3>
      <span class="task-type-badge">${task.type || 'задание'}</span>
    `;
    taskBlock.appendChild(header);

    // Инструкция
    if (task.instruction) {
      const instr = document.createElement('div');
      instr.className = 'task-instruction';
      instr.innerHTML = `<i class="fas fa-info-circle"></i> ${safeText(task.instruction)}`;
      taskBlock.appendChild(instr);
    }

    // Контент задания в зависимости от типа
    const contentDiv = document.createElement('div');
    contentDiv.className = 'task-content';
    
    switch (task.type) {
      case 'match':
        renderMatchTask(contentDiv, task);
        break;
      case 'quiz':
        renderQuizTask(contentDiv, task);
        break;
      case 'gap-fill':
        renderGapFillTask(contentDiv, task);
        break;
      default:
        renderDefaultTask(contentDiv, task);
    }
    
    taskBlock.appendChild(contentDiv);

    // Кнопка проверки (если есть ответ)
    if (task.answer) {
      const checkBtn = document.createElement('button');
      checkBtn.className = 'check-btn';
      checkBtn.textContent = 'Проверить';
      
      const resultDiv = document.createElement('div');
      resultDiv.className = 'result-message';
      resultDiv.style.display = 'none';
      
      checkBtn.addEventListener('click', () => {
        const userAnswer = taskBlock.querySelector('[data-user-answer]')?.value || '';
        const isCorrect = userAnswer.toLowerCase().trim() === task.answer.toLowerCase().trim();
        
        resultDiv.textContent = isCorrect ? '✅ Правильно!' : '❌ Попробуйте еще раз';
        resultDiv.className = `result-message ${isCorrect ? 'correct' : 'incorrect'}`;
        resultDiv.style.display = 'block';
      });
      
      taskBlock.appendChild(checkBtn);
      taskBlock.appendChild(resultDiv);
    }

    container.appendChild(taskBlock);
  });
}

function renderMatchTask(container, task) {
  if (!task.pairs) return;
  
  const grid = document.createElement('div');
  grid.className = 'match-grid';
  
  const leftCol = document.createElement('div');
  leftCol.className = 'match-column';
  leftCol.innerHTML = '<h4 style="margin-top:0;">Испанский</h4>';
  
  const rightCol = document.createElement('div');
  rightCol.className = 'match-column';
  rightCol.innerHTML = '<h4 style="margin-top:0;">Русский</h4>';
  
  const matchedPairs = new Set();
  
  task.pairs.forEach((pair, idx) => {
    // Левый элемент
    const leftItem = document.createElement('div');
    leftItem.className = 'match-item';
    leftItem.textContent = pair.left;
    leftItem.dataset.pairId = idx;
    leftItem.dataset.side = 'left';
    
    leftItem.addEventListener('click', () => {
      if (leftItem.classList.contains('matched')) return;
      
      if (selectedMatchLeft === leftItem) {
        leftItem.classList.remove('selected');
        selectedMatchLeft = null;
      } else {
        document.querySelectorAll('.match-item.selected').forEach(el => {
          el.classList.remove('selected');
        });
        leftItem.classList.add('selected');
        selectedMatchLeft = leftItem;
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
      
      if (selectedMatchLeft) {
        const leftId = selectedMatchLeft.dataset.pairId;
        
        if (leftId === String(idx)) {
          // Правильно
          selectedMatchLeft.classList.add('matched');
          selectedMatchLeft.classList.remove('selected');
          rightItem.classList.add('matched');
          matchedPairs.add(idx);
          
          if (matchedPairs.size === task.pairs.length) {
            showToast('🎉 Отлично! Все пары собраны!');
          }
        } else {
          // Неправильно
          showToast('Попробуйте другую пару', 1000);
        }
        
        selectedMatchLeft = null;
      }
    });
    
    leftCol.appendChild(leftItem);
    rightCol.appendChild(rightItem);
  });
  
  grid.appendChild(leftCol);
  grid.appendChild(rightCol);
  container.appendChild(grid);
}

function renderQuizTask(container, task) {
  if (!task.questions) return;
  
  task.questions.forEach((q, qIdx) => {
    const questionDiv = document.createElement('div');
    questionDiv.style.marginBottom = '20px';
    
    questionDiv.innerHTML = `<p style="font-weight:500;">${q.question}</p>`;
    
    q.options.forEach((opt, optIdx) => {
      const label = document.createElement('label');
      label.className = 'quiz-option';
      
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `question_${qIdx}`;
      radio.value = opt;
      
      label.appendChild(radio);
      label.appendChild(document.createTextNode(' ' + opt));
      
      questionDiv.appendChild(label);
    });
    
    container.appendChild(questionDiv);
  });
}

function renderGapFillTask(container, task) {
  if (!task.text) return;
  
  const textDiv = document.createElement('div');
  textDiv.className = 'gap-fill-text';
  
  const parts = task.text.split('___');
  parts.forEach((part, idx) => {
    textDiv.appendChild(document.createTextNode(part));
    
    if (idx < parts.length - 1) {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = '...';
      input.style.width = '80px';
      input.style.margin = '0 4px';
      input.style.padding = '4px 8px';
      input.style.border = '1px solid var(--border)';
      input.style.borderRadius = '6px';
      input.setAttribute('data-user-answer', '');
      textDiv.appendChild(input);
    }
  });
  
  container.appendChild(textDiv);
}

function renderDefaultTask(container, task) {
  if (Array.isArray(task.content)) {
    const ul = document.createElement('ul');
    task.content.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
    container.appendChild(ul);
  } else if (task.content) {
    const p = document.createElement('p');
    p.textContent = task.content;
    container.appendChild(p);
  }
  
  if (task.wordBank?.length) {
    const bankDiv = document.createElement('div');
    bankDiv.style.marginTop = '10px';
    bankDiv.innerHTML = '<strong>Слова для справки:</strong> ';
    bankDiv.innerHTML += task.wordBank.map(w => 
      `<span style="display:inline-block; padding:4px 8px; margin:4px; background:#f1f5f9; border-radius:30px;">${w}</span>`
    ).join('');
    container.appendChild(bankDiv);
  }
}

function renderVocabulary() {
  const container = $('vocab-content');
  container.innerHTML = '';
  
  if (!currentSong.vocabulary?.length) {
    container.innerHTML = '<p class="muted">Лексика пока не добавлена</p>';
    return;
  }
  
  currentSong.vocabulary.forEach(word => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = word;
    container.appendChild(chip);
  });
}

function renderCulture() {
  const list = $('culture-list');
  list.innerHTML = '';
  
  const items = currentSong.culture?.items;
  if (!items?.length) {
    list.innerHTML = '<li class="muted">Культурные реалии не указаны</li>';
    return;
  }
  
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });
}

function renderGrammar() {
  const list = $('grammar-list');
  list.innerHTML = '';
  
  if (!currentSong.analysis?.length && !currentSong.grammar?.length) {
    list.innerHTML = '<li class="muted">Грамматические заметки отсутствуют</li>';
    return;
  }
  
  if (currentSong.analysis?.length) {
    currentSong.analysis.forEach(item => {
      const li = document.createElement('li');
      li.textContent = typeof item === 'string' ? item : safeText(item);
      list.appendChild(li);
    });
  }
  
  if (currentSong.grammar?.length) {
    currentSong.grammar.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<i class="fas fa-check" style="color:var(--accent);"></i> ${item}`;
      list.appendChild(li);
    });
  }
}

function renderRestrictions() {
  const list = $('restrictions-list');
  list.innerHTML = '';
  
  const r = currentSong.restrictions || {};
  const items = [];
  
  if (r.age) items.push(`Возрастное ограничение: ${r.age}`);
  if (r.containsOtherLanguages) items.push('Содержит фрагменты на других языках');
  if (r.profanity && r.profanity !== 'none') items.push(`Ненормативная лексика: ${r.profanity}`);
  if (r.note) items.push(r.note);
  
  if (!items.length) {
    list.innerHTML = '<li class="muted">Ограничений нет</li>';
    return;
  }
  
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });
}

// ===== Инициализация =====
document.addEventListener('DOMContentLoaded', () => {
  loadSong();
});