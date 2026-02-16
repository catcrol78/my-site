// song.js - с поддержкой интерактивных заданий
console.log("🎵 song.js загружен");

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

// Получаем ID из URL
const urlParams = new URLSearchParams(window.location.search);
const songId = parseInt(urlParams.get('id'));

document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM загружен, ищем песню с ID:", songId);
  
  // Проверяем наличие данных (без window, напрямую)
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
  renderSong(song);
});

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
  // Заголовок и исполнитель
  $('song-title').textContent = safeText(song.title);
  $('song-artist').textContent = song.artist || '';
  
  // Видео
  if (song.youtubeId) {
    $('video-iframe').src = `https://www.youtube.com/embed/${song.youtubeId}`;
  }
  
  // Текст песни
  renderLyrics(song.lyrics);
  
  // Задания
  renderTasks(song.tasks);
  
  // Лексика
  renderVocabulary(song.vocabulary);
  
  // Бейджи
  renderBadges(song);
  
  // Показываем контент
  $('song-content').style.display = 'block';
  hideLoader();
}

function renderLyrics(lyrics) {
  const container = $('lyrics-content');
  if (!lyrics || !lyrics.length) {
    container.innerHTML = '<p class="muted">Текст пока не добавлен</p>';
    return;
  }
  container.innerHTML = lyrics.map(l => `<p>${escapeHtml(l.text)}</p>`).join('');
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

  const text = task.text;
  const parts = text.split('___');
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
