// admin.js – полная версия для новой админки (компактный интерфейс)
// Возможности:
// - загрузка песен из localStorage и songs-data.js
// - редактирование песен (клик по строке или кнопка ✏️)
// - сохранение (добавление/обновление) в localStorage
// - экспорт в songs-data.js (одна кнопка)
// - очистка формы и набора с подтверждением

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
function extractYouTubeId(input) {
  const raw = (input || "").trim();
  if (!raw) return "";
  if (/^[a-zA-Z0-9_-]{6,20}$/.test(raw) && !raw.includes("http")) return raw;
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
  const m = raw.match(/v=([a-zA-Z0-9_-]{6,20})/);
  return m ? m[1] : raw;
}
function youtubeCoverUrl(id) { return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : ""; }
function safeSlug(s) {
  return (s || "song").toString().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
// ===== Предпросмотр YouTube =====
function updateYouTubePreview() {
  const input = document.getElementById('youtubeInput');
  const previewDiv = document.getElementById('ytPreview');
  const previewImg = document.getElementById('ytPreviewImg');
  if (!input || !previewDiv || !previewImg) return;

  const raw = input.value.trim();
  const id = extractYouTubeId(raw); // extractYouTubeId уже существует в admin.js

  if (id && id.length >= 6) {
    const coverUrl = youtubeCoverUrl(id); // youtubeCoverUrl тоже уже есть
    previewImg.src = coverUrl;
    previewDiv.style.display = 'block';
    // Если картинка не загрузится (например, YouTube вернёт 404), скроем превью
    previewImg.onerror = () => {
      previewDiv.style.display = 'none';
      previewImg.src = '';
    };
  } else {
    previewDiv.style.display = 'none';
    previewImg.src = '';
  }
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

// ===== Редактор заданий =====
function createTaskEditor(index) {
  const wrap = document.createElement("div");
  wrap.className = "task-editor";
  wrap.innerHTML = `
    <div class="task-top">
      <h4>Задание <span class="task-number">${index + 1}</span></h4>
      <button class="task-remove" type="button" data-action="remove">Удалить</button>
    </div>
    <div class="task-grid">
      <div class="admin-field">
        <label>Название (ru)</label>
        <input type="text" data-field="titleRu" placeholder="Разминка" />
      </div>
      <div class="admin-field">
        <label>Название (es)</label>
        <input type="text" data-field="titleEs" placeholder="Calentamiento" />
      </div>
      <div class="admin-field">
        <label>Тип</label>
        <select data-field="type">
          <option value="warm-up">warm-up</option>
          <option value="gap-fill">gap-fill</option>
          <option value="grammar">grammar</option>
          <option value="speaking">speaking</option>
          <option value="listening">listening</option>
          <option value="writing">writing</option>
          <option value="vocabulary">vocabulary</option>
          <option value="culture">culture</option>
        </select>
      </div>
      <div class="admin-field">
        <label>Ответ (необязательно)</label>
        <input type="text" data-field="answer" placeholder="respirar / oído / acuerdes" />
      </div>
      <div class="admin-field">
        <label>Инструкция (ru)</label>
        <textarea data-field="instrRu" placeholder="что сделать ученику"></textarea>
      </div>
      <div class="admin-field">
        <label>Инструкция (es)</label>
        <textarea data-field="instrEs" placeholder="instrucciones"></textarea>
      </div>
      <div class="admin-field">
        <label>Контент (по строке)</label>
        <textarea data-field="content" placeholder="строка 1\nстрока 2\n..."></textarea>
      </div>
      <div class="admin-field">
        <label>Word bank (по слову на строке, опционально)</label>
        <textarea data-field="wordBank" placeholder="palabra1\npalabra2"></textarea>
      </div>
    </div>
  `;
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
function renumberTasks() {
  const tasks = Array.from(document.querySelectorAll("#tasksContainer .task-editor"));
  tasks.forEach((el, idx) => {
    const num = el.querySelector(".task-number");
    if (num) num.textContent = String(idx + 1);
  });
  document.getElementById("tasksCount").textContent = String(tasks.length);
}

// ===== Построение объекта песни из формы =====
function buildSong() {
  const idInput = document.getElementById("id");
  const idVal = (idInput.value || "").trim();
  const youtubeId = extractYouTubeId(document.getElementById("youtubeInput").value);
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
  const lyrics = parseLyrics(document.getElementById("lyrics").value);
  const cover = youtubeCoverUrl(youtubeId);

  const taskEditors = Array.from(document.querySelectorAll("#tasksContainer .task-editor"));
  const tasks = taskEditors.map(el => {
    const get = (field) => (el.querySelector(`[data-field="${field}"]`)?.value || "").trim();
    const title = { ru: get("titleRu"), es: get("titleEs") };
    const instruction = { ru: get("instrRu"), es: get("instrEs") };
    const type = get("type") || "warm-up";
    const answer = get("answer");
    const contentLines = linesToArray(el.querySelector('[data-field="content"]')?.value || "");
    const content = contentLines.length <= 1 ? (contentLines[0] || "") : contentLines;
    const wordBank = linesToArray(get("wordBank"));
    const taskObj = { title, type, instruction, content };
    if (answer) taskObj.answer = answer;
    if (wordBank.length) taskObj.wordBank = wordBank;
    return taskObj;
  }).filter(t => t.title.ru || t.title.es || t.instruction.ru || t.instruction.es || t.content);

  const autoId = getNextId();
  const finalId = idVal ? Number(idVal) : autoId;

  return {
    id: finalId,
    title: { ru: titleRu || "", es: titleEs || "" },
    artist: artist || "",
    youtubeId: youtubeId || "",
    cover,
    level: level ? [level] : [],
    themes,
    grammar,
    vocabulary,
    culture: { tags: cultureTags, items: cultureItems },
    restrictions: { age, containsOtherLanguages, profanity, sensitiveTopics: [], note },
    lyrics,
    pdf: pdf || "",
    analysis: [],
    tasks
  };
}

// ===== Загрузка песни в форму =====
function loadSongIntoForm(song) {
  if (!song) return;
  document.getElementById("id").value = song.id || "";
  document.getElementById("youtubeInput").value = song.youtubeId || "";
  updateYouTubePreview(); // показать превью для загруженной песни
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
  const lyricsText = (song.lyrics || []).map(l => l.time ? `${l.time} | ${l.text}` : l.text).join("\n");
  document.getElementById("lyrics").value = lyricsText;

  const tasksContainer = document.getElementById("tasksContainer");
  tasksContainer.innerHTML = "";
  if (song.tasks && song.tasks.length > 0) {
    song.tasks.forEach((task, index) => {
      const editor = createTaskEditor(index);
      editor.querySelector('[data-field="titleRu"]').value = task.title?.ru || "";
      editor.querySelector('[data-field="titleEs"]').value = task.title?.es || "";
      editor.querySelector('[data-field="type"]').value = task.type || "warm-up";
      editor.querySelector('[data-field="answer"]').value = task.answer || "";
      editor.querySelector('[data-field="instrRu"]').value = task.instruction?.ru || "";
      editor.querySelector('[data-field="instrEs"]').value = task.instruction?.es || "";
      const contentField = editor.querySelector('[data-field="content"]');
      if (Array.isArray(task.content)) contentField.value = task.content.join("\n");
      else contentField.value = task.content || "";
      const wbField = editor.querySelector('[data-field="wordBank"]');
      if (Array.isArray(task.wordBank)) wbField.value = task.wordBank.join("\n");
      else wbField.value = "";
      tasksContainer.appendChild(editor);
    });
  }
  renumberTasks();
  // Не обновляем YouTube preview автоматически, но можно вызвать
  // updateYouTubePreview(); // если нужен показ
  showToast(`Песня "${song.title?.ru || song.title?.es || song.id}" загружена`);
}

// ===== Валидация =====
const REQUIRED_FIELDS = ["youtubeInput", "artist", "titleRu", "titleEs"];
function setInvalid(el, isInvalid) {
  if (!el) return;
  el.classList.toggle("invalid", !!isInvalid);
}
function clearInvalidAll() {
  REQUIRED_FIELDS.forEach(id => setInvalid(document.getElementById(id), false));
}
function validateSong(song) {
  const errors = [];
  const youtubeOk = !!(song.youtubeId && song.youtubeId.trim().length >= 6);
  const artistOk = !!(song.artist && song.artist.trim().length >= 1);
  const titleOk = !!((song.title?.ru || "").trim() || (song.title?.es || "").trim());
  if (!youtubeOk) errors.push("• YouTube: вставь ссылку или ID (обязательно).");
  if (!artistOk) errors.push("• Исполнитель: заполни (обязательно).");
  if (!titleOk) errors.push("• Название: заполни хотя бы ru или es (обязательно).");
  setInvalid(document.getElementById("youtubeInput"), !youtubeOk);
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

// ===== Сохранение песни (upsert) =====
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
  // обновить ID placeholder (может измениться)
  primeIdPlaceholder();
}

// ===== Инициализация =====
document.addEventListener("DOMContentLoaded", () => {
  const tasksContainer = document.getElementById("tasksContainer");
  function primeIdPlaceholder() {
    const idInput = document.getElementById("id");
    if (!idInput.value) idInput.placeholder = `например ${getNextId()}`;
      }
  renumberTasks();
  primeIdPlaceholder();
  // Предпросмотр YouTube с debounce
let ytPreviewTimeout;
const debouncedUpdatePreview = () => {
  clearTimeout(ytPreviewTimeout);
  ytPreviewTimeout = setTimeout(updateYouTubePreview, 400);
};

document.getElementById('youtubeInput').addEventListener('input', debouncedUpdatePreview);

  // Подписка на изменение полей для снятия ошибок
  ["youtubeInput","artist","titleRu","titleEs"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      setInvalid(el, false);
      showErrors([]);
    });
  });

  // Кнопки
  document.getElementById("btnAddTask").addEventListener("click", () => {
    tasksContainer.appendChild(createTaskEditor(tasksContainer.children.length));
    renumberTasks();
  });

  document.getElementById("btnSaveSong").addEventListener("click", saveSong);

  document.getElementById("btnNewSong").addEventListener("click", () => {
    document.getElementById("btnClear").click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.getElementById("btnExportSetJs").addEventListener("click", () => {
    const set = loadSet();
    if (!set.length) return alert("Общий набор пустой.");
    const merged = mergeSongs(getExternalSongs(), set);
    downloadText("songs-data.js", exportSongsDataJs(merged), "application/javascript;charset=utf-8");
    showToast(`Экспортировано ${merged.length} песен`);
  });

  document.getElementById("btnClear").addEventListener("click", () => {
    if (confirm("Очистить форму? Все несохранённые данные будут потеряны.")) {
      document.getElementById("id").value = "";
      document.getElementById("youtubeInput").value = "";
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
      document.getElementById("tasksContainer").innerHTML = "";
      updateYouTubePreview(); // скрыть превью
      renumberTasks();
      // Не обновляем YouTube preview здесь, но можно сбросить
      const ytPreview = document.getElementById("ytPreview");
      if (ytPreview) ytPreview.style.display = "none";
      const ytMeta = document.getElementById("ytMeta");
      if (ytMeta) ytMeta.style.display = "none";
      clearInvalidAll();
      showErrors([]);
      primeIdPlaceholder();
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

  // Слушатель на список песен (редактирование/удаление)
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

  // Автосинхронизация внешних песен при загрузке
  (function autoSyncExternalToSet() {
    const external = getExternalSongs();
    if (!external || !external.length) return;
    const currentSet = loadSet();
    const merged = mergeSongs(external, currentSet);
    const same = JSON.stringify(merged) === JSON.stringify(currentSet);
    if (!same) saveSet(merged);
    renderSet();
  })();

  // Управление скроллом
  const scrollBtn = document.getElementById('scrollTop');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      scrollBtn.classList.toggle('visible', window.scrollY > 300);
    });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
});
