// admin.js – полная версия с поддержкой карточек-перевёртышей, живых заданий и переводов
// Обновлено для поддержки нескольких видеопровайдеров (YouTube / Kinescope)
console.log("admin.js загружен (поддержка Kinescope)");

// ===== Вспомогательные функции =====
function linesToArray(text) {
  return (text || "").split("\n").map(s => s.trim()).filter(Boolean);
}
function csvToArray(text) {
  return (text || "").split(",").map(s => s.trim()).filter(Boolean);
}
function parseLyrics(text) {
  const rows = linesToArray(text);
  return rows.map(row => {
    const parts = row.split("|");
    if (parts.length < 2) return { time: "", text: row.trim() };
    return { time: parts[0].trim(), text: parts.slice(1).join("|").trim() };
  });
}
function checkedValues(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`)).map(i => i.value);
}

// Извлекает ID видео из введённого значения (поддерживает прямые ID и ссылки YouTube)
function extractVideoId(input) {
  const raw = (input || "").trim();
  if (!raw) return "";
  
  // Если это просто ID (буквы, цифры, дефис, подчёркивание)
  if (/^[a-zA-Z0-9_-]{6,}$/.test(raw) && !raw.includes("http") && !raw.includes("/")) {
    return raw;
  }
  
  // Попытка извлечь из ссылки YouTube
  try {
    const url = new URL(raw);
    const v = url.searchParams.get("v");
    if (v) return v;
    if (url.hostname.includes("youtu.be")) return url.pathname.replace("/", "");
    const parts = url.pathname.split("/").filter(Boolean);
    const shortsIdx = parts.indexOf("shorts");
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
  } catch (_) {}
  
  // Регулярка для YouTube
  const m = raw.match(/v=([a-zA-Z0-9_-]{6,20})/);
  return m ? m[1] : raw; // если ничего не нашли, возвращаем как есть (возможно, ID Kinescope)
}

// Генерирует URL обложки для YouTube, для Kinescope возвращает пустую строку
function getCoverUrl(provider, id) {
  if (provider === "youtube" && id) {
    return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  }
  return ""; // Для Kinescope обложка не генерируется автоматически
}

function downloadText(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ===== Работа с localStorage =====
const SET_KEY = "songs_admin_set_v1";

function loadSet() {
  try {
    const raw = localStorage.getItem(SET_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveSet(arr) {
  localStorage.setItem(SET_KEY, JSON.stringify(arr));
}
function upsertSongInSet(song, force = false) {
  const set = loadSet();
  const idx = set.findIndex(s => String(s.id) === String(song.id));
  if (idx >= 0 && !force) {
    return { conflict: true, existing: set[idx] };
  }
  if (idx >= 0) set[idx] = song;
  else set.push(song);
  saveSet(set);
  return { success: true, set };
}
function removeSongFromSet(id) {
  const set = loadSet().filter(s => String(s.id) !== String(id));
  saveSet(set);
  return set;
}
function clearSet() {
  saveSet([]);
  return [];
}
function getSongFromSet(id) {
  const set = loadSet();
  return set.find(s => String(s.id) === String(id));
}
function getExternalSongs() {
  return (typeof songsDataFromExternal !== "undefined" && Array.isArray(songsDataFromExternal))
    ? songsDataFromExternal : [];
}
function mergeSongs(existing, additions) {
  const map = new Map();
  (existing || []).forEach(s => { if (s) map.set(String(s.id), s); });
  (additions || []).forEach(s => { if (s) map.set(String(s.id), s); });
  return Array.from(map.values()).sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
}
function maxIdFromArray(arr) {
  return (arr || []).reduce((mx, s) => {
    const v = Number(s?.id);
    return Number.isFinite(v) ? Math.max(mx, v) : mx;
  }, 0);
}
function getNextId() {
  const set = loadSet();
  const maxInSet = maxIdFromArray(set);
  const maxInExternal = getExternalSongs().length ? maxIdFromArray(getExternalSongs()) : 0;
  return Math.max(maxInSet, maxInExternal) + 1;
}

// ===== Предпросмотр видео (только для YouTube) =====
function updateVideoPreview() {
  const providerSelect = document.getElementById('videoProvider');
  const videoIdInput = document.getElementById('videoId');
  const previewDiv = document.getElementById('videoPreview');
  const previewImg = document.getElementById('videoPreviewImg');
  if (!providerSelect || !videoIdInput || !previewDiv || !previewImg) return;

  const provider = providerSelect.value;
  const rawId = videoIdInput.value.trim();
  const id = extractVideoId(rawId); // очищаем ID

  if (provider === 'youtube' && id && id.length >= 6) {
    const coverUrl = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
    previewImg.src = coverUrl;
    previewDiv.style.display = 'block';
    previewImg.onerror = () => {
      previewDiv.style.display = 'none';
      previewImg.src = '';
    };
  } else {
    previewDiv.style.display = 'none';
    previewImg.src = '';
  }
}

// ===== Редактор обычных заданий =====
function createTaskEditor(index, taskData = null) {
  const wrap = document.createElement("div");
  wrap.className = "task-editor";
  wrap.dataset.taskIndex = index;

  let html = `
    <div class="task-top">
      <h4>Задание <span class="task-number">${index + 1}</span></h4>
      <button class="task-remove" type="button" data-action="remove">Удалить</button>
    </div>
    <div class="task-grid">
      <div class="admin-field">
        <label>Название (ru)</label>
        <input type="text" data-field="titleRu" placeholder="Разминка" value="${(taskData?.title?.ru || '').replace(/"/g, '&quot;')}" />
      </div>
      <div class="admin-field">
        <label>Название (es)</label>
        <input type="text" data-field="titleEs" placeholder="Calentamiento" value="${(taskData?.title?.es || '').replace(/"/g, '&quot;')}" />
      </div>
      <div class="admin-field">
        <label>Тип</label>
        <select data-field="type" class="task-type-select">
          <option value="listening" ${taskData?.type === 'listening' ? 'selected' : ''}>Аудирование</option>
          <option value="speaking" ${taskData?.type === 'speaking' ? 'selected' : ''}>Говорение</option>
          <option value="reading" ${taskData?.type === 'reading' ? 'selected' : ''}>Чтение</option>
          <option value="writing" ${taskData?.type === 'writing' ? 'selected' : ''}>Письмо</option>
          <option value="grammar" ${taskData?.type === 'grammar' ? 'selected' : ''}>Грамматика</option>
          <option value="vocabulary" ${taskData?.type === 'vocabulary' ? 'selected' : ''}>Лексика</option>
          <option value="culture" ${taskData?.type === 'culture' ? 'selected' : ''}>Культура</option>
          <option value="gapfill" ${taskData?.type === 'gapfill' ? 'selected' : ''}>Заполнение пропусков</option>
          <option value="quiz" ${taskData?.type === 'quiz' ? 'selected' : ''}>Викторина</option>
          <option value="match" ${taskData?.type === 'match' ? 'selected' : ''}>Сопоставление</option>
          <option value="flashcards" ${taskData?.type === 'flashcards' ? 'selected' : ''}>Карточки-перевёртыши</option>
        </select>
      </div>
      <div class="admin-field">
        <label>Инструкция (ru)</label>
        <textarea data-field="instrRu" placeholder="что сделать ученику">${(taskData?.instruction?.ru || '').replace(/</g, '&lt;')}</textarea>
      </div>
      <div class="admin-field">
        <label>Инструкция (es)</label>
        <textarea data-field="instrEs" placeholder="instrucciones">${(taskData?.instruction?.es || '').replace(/</g, '&lt;')}</textarea>
      </div>
    </div>
    <div class="task-extra-fields" id="task-extra-${index}"></div>
  `;

  wrap.innerHTML = html;

  const typeSelect = wrap.querySelector('.task-type-select');
  typeSelect.addEventListener('change', () => {
    updateExtraFields(wrap, typeSelect.value, null);
  });

  updateExtraFields(wrap, typeSelect.value, taskData);

  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='remove']");
    if (!btn) return;
    if (confirm("Удалить это задание?")) {
      wrap.remove();
      renumberTasks();
    }
  });

  return wrap;
}

function updateExtraFields(wrap, type, taskData) {
  const container = wrap.querySelector('.task-extra-fields');
  container.innerHTML = '';

  let extraHtml = '';

  switch (type) {
    case 'flashcards':
      const cards = taskData?.flashcards || taskData?.cards || [];
      extraHtml = `
        <div class="admin-field" style="grid-column: span 2;">
          <label>Карточки для словаря (каждая карточка с новой строки в формате: испанское | перевод | пример | перевод примера)</label>
          <textarea data-field="flashcardsData" rows="8" placeholder="viajar | путешествовать | Me gusta viajar | Мне нравится путешествовать&#10;soñar | мечтать | Sueño con viajar | Я мечтаю путешествовать">${cards.map(c => 
            `${c.es || c.word || ''} | ${c.ru || c.translation || ''} | ${c.example || ''} | ${c.example_translation || ''}`
          ).join('\n')}</textarea>
          <small>Формат: слово | перевод | пример | перевод примера (три черты разделяют поля, можно оставлять пустыми)</small>
        </div>
        <div class="admin-field">
          <label>Транскрипция (если есть, будет показана на лицевой стороне)</label>
          <input type="text" data-field="flashcardsTranscription" placeholder="[bjaˈxaɾ]" value="${taskData?.transcription || ''}" />
        </div>
      `;
      break;

    case 'gapfill':
      extraHtml = `
        <div class="admin-field" style="grid-column: span 2;">
          <label>Текст с пропусками (используйте ___ для пропусков)</label>
          <textarea data-field="gapText" placeholder="Yo ___ (ir) a la playa. Tú ___ (bailar) bien.">${(taskData?.text || '').replace(/</g, '&lt;')}</textarea>
        </div>
        <div class="admin-field">
          <label>Ответы (через запятую, в порядке пропусков)</label>
          <input type="text" data-field="gapAnswers" placeholder="voy, bailas" value="${(taskData?.answers || []).join(', ')}" />
        </div>
        <div class="admin-field" style="grid-column: span 2;">
          <label>Варианты для выпадающего списка (опционально, для каждого пропуска через |, варианты через запятую)</label>
          <textarea data-field="gapOptions" placeholder="voy, vas, va | bailo, bailas, baila">${taskData?.options ? taskData.options.map(arr => arr.join(', ')).join(' | ') : ''}</textarea>
          <small>Пример: для двух пропусков: "voy, vas, va | bailo, bailas, baila"</small>
        </div>
      `;
      break;

    case 'quiz':
      extraHtml = `
        <div class="admin-field" style="grid-column: span 2;">
          <label>Вопросы (JSON-формат)</label>
          <textarea data-field="quizQuestions" rows="8" placeholder='[{"question": "¿Cómo se dice casa?", "options": ["casa","perro","gato"], "correct": 0}]'>${taskData?.questions ? JSON.stringify(taskData.questions, null, 2) : ''}</textarea>
          <small>Массив объектов: { "question": "...", "options": ["...", "..."], "correct": индекс правильного ответа }</small>
        </div>
      `;
      break;

    case 'match':
      extraHtml = `
        <div class="admin-field" style="grid-column: span 2;">
          <label>Пары для сопоставления (левая часть | правая часть, каждая пара с новой строки)</label>
          <textarea data-field="matchPairs" rows="6" placeholder="casa | дом&#10;perro | собака">${taskData?.pairs ? taskData.pairs.map(p => `${p.left} | ${p.right}`).join('\n') : ''}</textarea>
        </div>
      `;
      break;

    default:
      extraHtml = `
        <div class="admin-field" style="grid-column: span 2;">
          <label>Контент (текст задания)</label>
          <textarea data-field="content" placeholder="Текст задания" rows="4">${(taskData?.content || '').replace(/</g, '&lt;')}</textarea>
        </div>
        <div class="admin-field" style="grid-column: span 2;">
          <label>Word bank (по слову на строке)</label>
          <textarea data-field="wordBank" placeholder="palabra1&#10;palabra2" rows="4">${(taskData?.wordBank || []).join('\n')}</textarea>
        </div>
        <div class="admin-field">
          <label>Ответ (если есть)</label>
          <input type="text" data-field="answer" placeholder="Правильный ответ" value="${(taskData?.answer || '').replace(/"/g, '&quot;')}" />
        </div>
      `;
  }

  container.innerHTML = extraHtml;
}

function collectTaskData(wrap) {
  const type = wrap.querySelector('[data-field="type"]').value;
  const titleRu = wrap.querySelector('[data-field="titleRu"]').value;
  const titleEs = wrap.querySelector('[data-field="titleEs"]').value;
  const instrRu = wrap.querySelector('[data-field="instrRu"]').value;
  const instrEs = wrap.querySelector('[data-field="instrEs"]').value;

  const task = {
    title: { ru: titleRu, es: titleEs },
    instruction: { ru: instrRu, es: instrEs },
    type: type
  };

  switch (type) {
    case 'flashcards':
      const cardsText = wrap.querySelector('[data-field="flashcardsData"]')?.value || '';
      const transcription = wrap.querySelector('[data-field="flashcardsTranscription"]')?.value || '';
      const cards = cardsText.split('\n').map(line => {
        const parts = line.split('|').map(s => s.trim());
        return {
          es: parts[0] || '',
          ru: parts[1] || '',
          example: parts[2] || '',
          example_translation: parts[3] || '',
          transcription: transcription
        };
      }).filter(card => card.es || card.ru);
      task.flashcards = cards;
      break;

    case 'gapfill':
      task.text = wrap.querySelector('[data-field="gapText"]')?.value || '';
      const answersStr = wrap.querySelector('[data-field="gapAnswers"]')?.value || '';
      task.answers = answersStr.split(',').map(s => s.trim()).filter(Boolean);
      const optionsStr = wrap.querySelector('[data-field="gapOptions"]')?.value || '';
      if (optionsStr) {
        task.options = optionsStr.split('|').map(part => 
          part.split(',').map(s => s.trim()).filter(Boolean)
        );
      }
      break;

    case 'quiz':
      const questionsStr = wrap.querySelector('[data-field="quizQuestions"]')?.value || '';
      try {
        task.questions = JSON.parse(questionsStr);
      } catch (e) {
        alert('Ошибка в JSON вопросов для викторины');
        task.questions = [];
      }
      break;

    case 'match':
      const pairsStr = wrap.querySelector('[data-field="matchPairs"]')?.value || '';
      task.pairs = pairsStr.split('\n').map(line => {
        const parts = line.split('|').map(s => s.trim());
        if (parts.length === 2) {
          return { left: parts[0], right: parts[1] };
        }
        return null;
      }).filter(Boolean);
      break;

    default:
      task.content = wrap.querySelector('[data-field="content"]')?.value || '';
      const wb = wrap.querySelector('[data-field="wordBank"]')?.value || '';
      task.wordBank = linesToArray(wb);
      task.answer = wrap.querySelector('[data-field="answer"]')?.value || '';
  }

  return task;
}

function renumberTasks() {
  const tasks = Array.from(document.querySelectorAll("#tasksContainer .task-editor"));
  tasks.forEach((el, idx) => {
    const num = el.querySelector(".task-number");
    if (num) num.textContent = String(idx + 1);
    el.dataset.taskIndex = idx;
  });
  document.getElementById("tasksCount").textContent = String(tasks.length);
}

// ===== Редактор живых заданий =====
function createLiveTaskEditor(index, taskData = null) {
  const wrap = document.createElement("div");
  wrap.className = "task-editor";
  wrap.dataset.taskIndex = index;

  let html = `
    <div class="task-top">
      <h4>Живое задание <span class="task-number">${index + 1}</span></h4>
      <button class="task-remove" type="button" data-action="remove">Удалить</button>
    </div>
    <div class="task-grid">
      <div class="admin-field">
        <label>Тип</label>
        <select data-field="type" class="live-type-select">
          <option value="word-catch" ${taskData?.type === 'word-catch' ? 'selected' : ''}>Лови слово</option>
          <option value="translate" ${taskData?.type === 'translate' ? 'selected' : ''}>Перевод</option>
          <option value="gapfill" ${taskData?.type === 'gapfill' ? 'selected' : ''}>Заполни пропуск</option>
        </select>
      </div>
      <div class="admin-field">
        <label>Время (сек)</label>
        <input type="number" step="0.1" data-field="time" value="${taskData?.time ?? ''}" placeholder="35.5" />
      </div>
      <div class="admin-field" style="grid-column: span 2;">
        <label>Правильный ответ</label>
        <input type="text" data-field="correct" value="${(taskData?.correct || '').replace(/"/g, '&quot;')}" />
      </div>
      <div class="admin-field" style="grid-column: span 2;">
        <label>Варианты ответов (по одному на строке)</label>
        <textarea data-field="options" rows="3">${(taskData?.options || []).join('\n')}</textarea>
      </div>
    </div>
    <div class="live-extra-fields" id="live-extra-${index}"></div>
  `;

  wrap.innerHTML = html;

  const typeSelect = wrap.querySelector('.live-type-select');
  typeSelect.addEventListener('change', () => {
    updateLiveExtraFields(wrap, typeSelect.value, null);
  });

  updateLiveExtraFields(wrap, typeSelect.value, taskData);

  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='remove']");
    if (!btn) return;
    if (confirm("Удалить это живое задание?")) {
      wrap.remove();
      renumberLiveTasks();
    }
  });

  return wrap;
}

function updateLiveExtraFields(wrap, type, taskData) {
  const container = wrap.querySelector('.live-extra-fields');
  container.innerHTML = '';

  let extraHtml = '';

  if (type === 'translate') {
    extraHtml = `
      <div class="admin-field" style="grid-column: span 2;">
        <label>Слово (испанское)</label>
        <input type="text" data-field="word" value="${(taskData?.word || '').replace(/"/g, '&quot;')}" />
      </div>
    `;
  } else if (type === 'gapfill') {
    extraHtml = `
      <div class="admin-field" style="grid-column: span 2;">
        <label>Строка с пропуском (используйте ___ )</label>
        <input type="text" data-field="line" value="${(taskData?.line || '').replace(/"/g, '&quot;')}" />
      </div>
    `;
  }

  container.innerHTML = extraHtml;
}

function collectLiveTaskData(wrap) {
  const type = wrap.querySelector('[data-field="type"]').value;
  const time = parseFloat(wrap.querySelector('[data-field="time"]').value) || 0;
  const correct = wrap.querySelector('[data-field="correct"]').value.trim();
  const optionsText = wrap.querySelector('[data-field="options"]').value;
  const options = optionsText.split('\n').map(s => s.trim()).filter(Boolean);

  const task = {
    type,
    time,
    correct,
    options
  };

  if (type === 'translate') {
    task.word = wrap.querySelector('[data-field="word"]').value.trim();
  } else if (type === 'gapfill') {
    task.line = wrap.querySelector('[data-field="line"]').value.trim();
  }

  return task;
}

function renumberLiveTasks() {
  const tasks = Array.from(document.querySelectorAll("#liveTasksContainer .task-editor"));
  tasks.forEach((el, idx) => {
    const num = el.querySelector(".task-number");
    if (num) num.textContent = String(idx + 1);
    el.dataset.taskIndex = idx;
  });
  document.getElementById("liveTasksCount").textContent = String(tasks.length);
}

// ===== Построение объекта песни из формы =====
function buildSong() {
  const idInput = document.getElementById("id");
  const idVal = (idInput.value || "").trim();
  
  // Видео данные
  const provider = document.getElementById("videoProvider").value;
  const rawVideoId = document.getElementById("videoId").value.trim();
  const videoId = extractVideoId(rawVideoId); // очищаем ID
  const cover = getCoverUrl(provider, videoId); // генерируем обложку только для YouTube
  
  const titleRu = document.getElementById("titleRu").value.trim();
  const titleEs = document.getElementById("titleEs").value.trim();
  const artist = document.getElementById("artist").value.trim();
  const level = document.getElementById("level").value.trim();
  const age = document.getElementById("age").value;
  const containsOtherLanguages = document.getElementById("otherLang").value === "true";
  const profanity = document.getElementById("profanity").value;
  const note = document.getElementById("restrNote").value.trim();
  const cultureTags = checkedValues("cultureTags");
  const cultureItems = linesToArray(document.getElementById("cultureItems").value);
  const vocabulary = linesToArray(document.getElementById("vocabulary").value);
  const grammar = csvToArray(document.getElementById("grammar").value);
  const themes = csvToArray(document.getElementById("themes").value);
  const pdf = (document.getElementById("pdfLink")?.value || "").trim();

  // Текст и переводы
  const lyrics = parseLyrics(document.getElementById("lyrics").value);
  const translationsText = document.getElementById("translations").value;
  const translations = linesToArray(translationsText);

  // Добавляем переводы к строкам
  lyrics.forEach((line, index) => {
    if (index < translations.length && translations[index]) {
      line.translation = translations[index];
    } else {
      line.translation = "";
    }
  });

  const taskEditors = Array.from(document.querySelectorAll("#tasksContainer .task-editor"));
  const tasks = taskEditors.map(el => collectTaskData(el));

  const liveTaskEditors = Array.from(document.querySelectorAll("#liveTasksContainer .task-editor"));
  const liveTasks = liveTaskEditors.map(el => collectLiveTaskData(el));

  const autoId = getNextId();
  const finalId = idVal ? Number(idVal) : autoId;

  return {
    id: finalId,
    title: { ru: titleRu || "", es: titleEs || "" },
    artist: artist || "",
    video: {
      provider: provider,
      id: videoId || ""
    },
    cover, // автоматически сгенерированная обложка (только для YouTube)
    level: level ? [level] : [],
    themes,
    grammar,
    vocabulary,
    culture: { tags: cultureTags, items: cultureItems },
    restrictions: { age, containsOtherLanguages, profanity, sensitiveTopics: [], note },
    lyrics,
    pdf: pdf || "",
    analysis: [],
    tasks,
    liveTasks
  };
}

// ===== Загрузка песни в форму =====
function loadSongIntoForm(song) {
  if (!song) return;
  document.getElementById("id").value = song.id || "";
  
  // Видео данные
  const provider = song.video?.provider || "youtube";
  const videoId = song.video?.id || "";
  document.getElementById("videoProvider").value = provider;
  document.getElementById("videoId").value = videoId;
  
  document.getElementById("titleRu").value = song.title?.ru || "";
  document.getElementById("titleEs").value = song.title?.es || "";
  document.getElementById("artist").value = song.artist || "";
  const levelSelect = document.getElementById("level");
  if (song.level && song.level.length > 0) levelSelect.value = song.level[0];
  else levelSelect.value = "";
  document.getElementById("age").value = song.restrictions?.age || "16+";
  document.getElementById("otherLang").value = song.restrictions?.containsOtherLanguages ? "true" : "false";
  document.getElementById("profanity").value = song.restrictions?.profanity || "none";
  document.getElementById("restrNote").value = song.restrictions?.note || "";
  const tags = song.culture?.tags || [];
  document.querySelectorAll('#cultureTags input[type="checkbox"]').forEach(ch => ch.checked = tags.includes(ch.value));
  document.getElementById("cultureItems").value = (song.culture?.items || []).join("\n");
  document.getElementById("vocabulary").value = (song.vocabulary || []).join("\n");
  document.getElementById("grammar").value = (song.grammar || []).join(", ");
  document.getElementById("pdfLink").value = song.pdf || "";
  document.getElementById("themes").value = (song.themes || []).join(", ");

  // Текст с таймкодами
  const lyricsText = (song.lyrics || []).map(l => l.time ? `${l.time} | ${l.text}` : l.text).join("\n");
  document.getElementById("lyrics").value = lyricsText;

  // Переводы построчно
  const translationsText = (song.lyrics || []).map(l => l.translation || "").join("\n");
  document.getElementById("translations").value = translationsText;

  const tasksContainer = document.getElementById("tasksContainer");
  tasksContainer.innerHTML = "";
  if (song.tasks && song.tasks.length > 0) {
    song.tasks.forEach((task, index) => {
      const editor = createTaskEditor(index, task);
      tasksContainer.appendChild(editor);
    });
  }
  renumberTasks();

  const liveTasksContainer = document.getElementById("liveTasksContainer");
  liveTasksContainer.innerHTML = "";
  if (song.liveTasks && song.liveTasks.length > 0) {
    song.liveTasks.forEach((task, index) => {
      const editor = createLiveTaskEditor(index, task);
      liveTasksContainer.appendChild(editor);
    });
  }
  renumberLiveTasks();

  updateVideoPreview();
  showToast(`Песня "${song.title?.ru || song.title?.es || song.id}" загружена`);
}

// ===== Валидация =====
const REQUIRED_FIELDS = ["videoId", "artist", "titleRu", "titleEs"]; // заменили youtubeInput на videoId
function setInvalid(el, isInvalid) {
  if (!el) return;
  el.classList.toggle("invalid", !!isInvalid);
}
function clearInvalidAll() {
  REQUIRED_FIELDS.forEach(id => setInvalid(document.getElementById(id), false));
}
function validateSong(song) {
  const errors = [];
  const videoOk = !!(song.video?.id && song.video.id.trim().length >= 1);
  const artistOk = !!(song.artist && song.artist.trim().length >= 1);
  const titleOk = !!((song.title?.ru || "").trim() || (song.title?.es || "").trim());
  if (!videoOk) errors.push("• ID видео: заполни (обязательно).");
  if (!artistOk) errors.push("• Исполнитель: заполни (обязательно).");
  if (!titleOk) errors.push("• Название: заполни хотя бы ru или es (обязательно).");
  setInvalid(document.getElementById("videoId"), !videoOk);
  setInvalid(document.getElementById("artist"), !artistOk);
  const titlesEmpty = !titleOk;
  setInvalid(document.getElementById("titleRu"), titlesEmpty);
  setInvalid(document.getElementById("titleEs"), titlesEmpty);
  return errors;
}
function showErrors(list) {
  const box = document.getElementById("adminErrors");
  if (!box) return;
  if (!list || !list.length) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }
  box.style.display = "block";
  box.innerHTML = `<strong>Нужно поправить:</strong><br/>${list.join("<br/>")}`;
}

// ===== Экспорт в songs-data.js =====
function exportSongsDataJs(set) {
  return `// Автосгенерировано из admin.html\nconst songsDataFromExternal = ${JSON.stringify(set, null, 2)};\n`;
}

// ===== Рендер списка песен =====
function renderSet() {
  const set = loadSet();
  const setCount = document.getElementById("setCount");
  if (setCount) setCount.textContent = String(set.length);
  const setList = document.getElementById("setList");
  if (!setList) return;
  setList.innerHTML = "";
  if (set.length === 0) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "Пока пусто. Добавьте песню через форму.";
    setList.appendChild(empty);
    return;
  }
  set.slice().sort((a,b) => (a.artist || "").localeCompare((b.artist || ""), "ru")).forEach(song => {
    const item = document.createElement("div");
    item.className = "set-item";
    item.innerHTML = `
      <div class="set-item-info" data-id="${song.id}" data-action="edit">
        <h4>${(song.title?.es || song.title?.ru || "—")} <span class="pill">ID: ${song.id}</span></h4>
        <p>${song.artist || "—"} • ${(song.level || []).join(", ") || "уровень —"}</p>
      </div>
      <div class="set-item-actions">
        <button class="btn-edit" data-act="edit" data-id="${song.id}" title="Редактировать"><i class="fas fa-edit"></i></button>
        <button class="btn-delete" data-act="remove" data-id="${song.id}" title="Удалить"><i class="fas fa-trash"></i></button>
      </div>
    `;
    setList.appendChild(item);
  });
}

// ===== Сохранение песни =====
function saveSong() {
  clearInvalidAll();
  const song = buildSong();
  const errs = validateSong(song);
  if (errs.length) {
    showErrors(errs);
    return;
  }
  showErrors([]);
  const result = upsertSongInSet(song);
  if (result.conflict) {
    const confirmReplace = confirm(`Песня с ID ${song.id} уже существует. Заменить её?`);
    if (confirmReplace) {
      upsertSongInSet(song, true);
      renderSet();
      showToast(`Песня заменена`);
    }
  } else {
    renderSet();
    showToast(`Песня сохранена`);
  }
}

// ===== Инициализация =====
document.addEventListener("DOMContentLoaded", () => {
  const tasksContainer = document.getElementById("tasksContainer");
  const liveTasksContainer = document.getElementById("liveTasksContainer");
  renumberTasks();
  renumberLiveTasks();

  // Заменили youtubeInput на videoId и добавили videoProvider
  ["videoId","artist","titleRu","titleEs"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      setInvalid(el, false);
      showErrors([]);
    });
  });

  // Предпросмотр видео при изменении провайдера или ID
  let previewTimeout;
  const debouncedUpdatePreview = () => {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(updateVideoPreview, 400);
  };
  document.getElementById('videoId').addEventListener('input', debouncedUpdatePreview);
  document.getElementById('videoProvider').addEventListener('change', debouncedUpdatePreview);

  document.getElementById("btnAddTask").addEventListener("click", () => {
    tasksContainer.appendChild(createTaskEditor(tasksContainer.children.length));
    renumberTasks();
  });

  document.getElementById("btnAddLiveTask").addEventListener("click", () => {
    liveTasksContainer.appendChild(createLiveTaskEditor(liveTasksContainer.children.length));
    renumberLiveTasks();
  });

  document.getElementById("btnSaveSong").addEventListener("click", saveSong);

  document.getElementById("btnNewSong").addEventListener("click", () => {
    document.getElementById("btnClear").click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.getElementById("btnExportSetJs").addEventListener("click", () => {
    const set = loadSet();
    if (!set.length) return alert("Общий набор пустой.");
    downloadText("songs-data.js", exportSongsDataJs(set), "application/javascript;charset=utf-8");
    showToast(`Экспортировано ${set.length} песен`);
  });

  document.getElementById("btnClear").addEventListener("click", () => {
    if (confirm("Очистить форму? Все несохранённые данные будут потеряны.")) {
      document.getElementById("id").value = "";
      document.getElementById("videoProvider").value = "youtube";
      document.getElementById("videoId").value = "";
      document.getElementById("titleRu").value = "";
      document.getElementById("titleEs").value = "";
      document.getElementById("artist").value = "";
      document.getElementById("level").value = "";
      document.getElementById("age").value = "16+";
      document.getElementById("otherLang").value = "false";
      document.getElementById("profanity").value = "none";
      document.getElementById("restrNote").value = "";
      document.querySelectorAll('#cultureTags input[type="checkbox"]').forEach(ch => ch.checked = false);
      document.getElementById("cultureItems").value = "";
      document.getElementById("vocabulary").value = "";
      document.getElementById("grammar").value = "";
      document.getElementById("pdfLink").value = "";
      document.getElementById("themes").value = "";
      document.getElementById("lyrics").value = "";
      document.getElementById("translations").value = "";
      document.getElementById("tasksContainer").innerHTML = "";
      document.getElementById("liveTasksContainer").innerHTML = "";
      renumberTasks();
      renumberLiveTasks();
      updateVideoPreview();
      clearInvalidAll();
      showErrors([]);
      showToast("Форма очищена");
    }
  });

  document.getElementById("btnClearSet").addEventListener("click", () => {
    const ok = confirm("Точно очистить общий набор? Это удалит все песни из localStorage.");
    if (!ok) return;
    clearSet();
    renderSet();
    showToast("Общий набор очищен");
  });

  const setList = document.getElementById("setList");
  if (setList) {
    setList.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-act]");
      const infoDiv = e.target.closest(".set-item-info");
      if (infoDiv) {
        const id = infoDiv.dataset.id;
        const song = getSongFromSet(id);
        if (song) {
          loadSongIntoForm(song);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-act");
      const set = loadSet();
      const song = set.find(s => String(s.id) === String(id));
      if (act === "remove") {
        if (confirm("Удалить эту песню из набора?")) {
          removeSongFromSet(id);
          renderSet();
          showToast("Песня удалена");
        }
        return;
      }
      if (act === "edit" && song) {
        loadSongIntoForm(song);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  (function autoSyncExternalToSet() {
    const external = getExternalSongs();
    if (!external || !external.length) return;
    const currentSet = loadSet();
    const merged = mergeSongs(external, currentSet);
    const same = JSON.stringify(merged) === JSON.stringify(currentSet);
    if (!same) saveSet(merged);
    renderSet();
  })();

  const scrollBtn = document.getElementById('scrollTop');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      scrollBtn.classList.toggle('visible', window.scrollY > 300);
    });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  setTimeout(updateVideoPreview, 100);
});
