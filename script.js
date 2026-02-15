// ===== State =====
let currentLang = localStorage.getItem("lang") || "ru";

// songs-data.js should define: const songsDataFromExternal = [...]
const allSongs = (typeof songsDataFromExternal !== "undefined" && Array.isArray(songsDataFromExternal))
  ? songsDataFromExternal
  : [];

let filteredSongs = [...allSongs];
let visibleCount = 20;

// ===== UI Helpers =====
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

// ===== i18n =====
const i18n = {
  ru: {
    siteTitle: "Каталог испанских песен",
    admin: "Админка",
    filtersTitle: "Поиск и фильтры",
    collapseHint: "нажми, чтобы свернуть",
    search: "Поиск",
    searchPlaceholder: "Название, автор, ключевое слово...",
    level: "Уровень",
    culture: "Культура",
    restrFilters: "Ограничения",
    exclude16: "Исключить 16+",
    excludeOtherLang: "Исключить другой язык",
    apply: "Применить",
    reset: "Сбросить",
    foundLabel: "Найдено песен:",
    welcome: "Добро пожаловать!",
    welcomeText: "Выберите песню из списка, чтобы открыть страницу с заданиями.",
    songList: "Список песен",
    mobileDetail: "Детали",
    mobileList: "Список",
    sortRelevance: "По релевантности",
    sortTitle: "По названию",
    sortArtist: "По исполнителю",
    loadMore: "Показать ещё",
    footerNote: "Каталог для учителей: испанский по песням",

    allLevels: "Все уровни",
    allCulture: "Любая культура",
    culture_geography: "География",
    culture_neighborhoods: "Районы/места",
    culture_holidays: "Праздники",
    culture_traditions: "Традиции",
    culture_food: "Еда",
    culture_dance_music: "Танцы/музыка",

    listShowing: (shown, total) => `Показано: ${shown} из ${total}`,
    noMatches: "Ничего не найдено по текущим фильтрам."
  },
  es: {
    siteTitle: "Catálogo de canciones en español",
    admin: "Admin",
    filtersTitle: "Búsqueda y filtros",
    collapseHint: "toca para contraer",
    search: "Buscar",
    searchPlaceholder: "Título, artista, palabra clave...",
    level: "Nivel",
    culture: "Cultura",
    restrFilters: "Restricciones",
    exclude16: "Excluir 16+",
    excludeOtherLang: "Excluir otro idioma",
    apply: "Aplicar",
    reset: "Restablecer",
    foundLabel: "Canciones encontradas:",
    welcome: "¡Bienvenido!",
    welcomeText: "Selecciona una canción de la lista para abrir la página con tareas.",
    songList: "Lista de canciones",
    mobileDetail: "Detalles",
    mobileList: "Lista",
    sortRelevance: "Por relevancia",
    sortTitle: "Por título",
    sortArtist: "Por artista",
    loadMore: "Mostrar más",
    footerNote: "Catálogo para profesores: español con canciones",

    allLevels: "Todos los niveles",
    allCulture: "Cualquier cultura",
    culture_geography: "Geografía",
    culture_neighborhoods: "Barrios/lugares",
    culture_holidays: "Fiestas",
    culture_traditions: "Tradiciones",
    culture_food: "Comida",
    culture_dance_music: "Baile/música",

    listShowing: (shown, total) => `Mostrando: ${shown} de ${total}`,
    noMatches: "No hay resultados con los filtros actuales."
  }
};

const themeLabels = {
  nature: { ru: "Природа", es: "Naturaleza" },
  weather: { ru: "Погода", es: "Tiempo" },
  love: { ru: "Любовь", es: "Amor" },
  dance: { ru: "Танцы", es: "Baile" },
  body: { ru: "Тело", es: "Cuerpo" }
};

const grammarLabels = {
  gustar: { ru: "Gustar", es: "Gustar" },
  gerundio: { ru: "Герундий", es: "Gerundio" },
  se: { ru: "Se", es: "Se" },
  ir_gerundio: { ru: "Ir + gerundio", es: "Ir + gerundio" }
};

const cultureLabels = {
  geography: { ru: "География", es: "Geografía" },
  neighborhoods: { ru: "Районы/места", es: "Barrios/lugares" },
  holidays: { ru: "Праздники", es: "Fiestas" },
  traditions: { ru: "Традиции", es: "Tradiciones" },
  food: { ru: "Еда", es: "Comida" },
  dance_music: { ru: "Танцы/музыка", es: "Baile/música" }
};

// ===== Helpers =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const t = (key) => (i18n[currentLang] && i18n[currentLang][key]) ? i18n[currentLang][key] : (i18n.ru[key] || "");

function safeText(objOrString) {
  if (!objOrString) return "";
  if (typeof objOrString === "string") return objOrString;
  if (typeof objOrString === "object") return objOrString[currentLang] || objOrString.ru || objOrString.es || "";
  return "";
}

function normalize(str) {
  return (str || "").toString().toLowerCase().trim();
}

function songTitle(song) {
  return song?.title?.[currentLang] || song?.title?.ru || song?.title?.es || "";
}

function escapeHtml(str) {
  return (str ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== Language apply =====
function applyLanguage() {
  document.documentElement.lang = currentLang;
  document.title = t("siteTitle");
  $("#year").textContent = new Date().getFullYear();

  $$("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (typeof val === "string") el.textContent = val;
  });

  $$("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    el.setAttribute("placeholder", t(key));
  });

  buildSelectOptions();
}

// ===== Build filter options from data =====
function uniq(arr) {
  return Array.from(new Set(arr)).filter(Boolean);
}

function buildSelectOptions() {
  // Levels
  const levels = uniq(allSongs.flatMap(s => Array.isArray(s.level) ? s.level : []));
  const levelSelect = $("#level-select");
  levelSelect.innerHTML = "";
  levelSelect.appendChild(new Option(t("allLevels"), ""));
  levels.sort((a, b) => a.localeCompare(b));
  levels.forEach(lv => levelSelect.appendChild(new Option(lv, lv)));

  // Culture tags (types)
  const tags = uniq(allSongs.flatMap(s => Array.isArray(s?.culture?.tags) ? s.culture.tags : []));
  const cultureSelect = $("#culture-select");
  cultureSelect.innerHTML = "";
  cultureSelect.appendChild(new Option(t("allCulture"), ""));
  tags.sort((a, b) => (cultureLabels[a]?.[currentLang] || a).localeCompare((cultureLabels[b]?.[currentLang] || b), currentLang));
  tags.forEach(tag => {
    const label = cultureLabels[tag]?.[currentLang] || tag;
    cultureSelect.appendChild(new Option(label, tag));
  });
}

// ===== Search haystack =====
function songSearchHaystack(song) {
  const titles = [song?.title?.ru || "", song?.title?.es || ""].join(" ");
  const artist = song?.artist || "";
  const vocab = Array.isArray(song?.vocabulary) ? song.vocabulary.join(" ") : "";
  const themes = Array.isArray(song?.themes) ? song.themes.map(k => themeLabels[k]?.[currentLang] || k).join(" ") : "";
  const grammar = Array.isArray(song?.grammar) ? song.grammar.map(k => grammarLabels[k]?.[currentLang] || k).join(" ") : "";
  const cultureItems = Array.isArray(song?.culture?.items) ? song.culture.items.join(" ") : "";
  const restrNote = song?.restrictions?.note || "";
  return normalize([titles, artist, vocab, themes, grammar, cultureItems, restrNote].join(" "));
}

// ===== Filtering & sorting =====
function filterSongs() {
  const q = normalize($("#main-search").value);
  const level = $("#level-select").value;
  const cultureTag = $("#culture-select").value;
  const exclude16 = $("#exclude-16plus").checked;
  const excludeOther = $("#exclude-otherlang").checked;

  return allSongs.filter(song => {
    const searchOk = !q || songSearchHaystack(song).includes(q);
    const levelOk = !level || (Array.isArray(song.level) && song.level.includes(level));
    const cultureOk = !cultureTag || (Array.isArray(song?.culture?.tags) && song.culture.tags.includes(cultureTag));
    const ageOk = !exclude16 || (song?.restrictions?.age !== "16+" && song?.restrictions?.age !== "18+");
    const otherOk = !excludeOther || !song?.restrictions?.containsOtherLanguages;

    return searchOk && levelOk && cultureOk && ageOk && otherOk;
  });
}

function sortSongs(songsToSort) {
  const mode = $("#sort-select").value;
  const sorted = [...songsToSort];
  
  if (mode === "title") {
    sorted.sort((a, b) => songTitle(a).localeCompare(songTitle(b), currentLang));
  } else if (mode === "artist") {
    sorted.sort((a, b) => (a.artist || "").localeCompare((b.artist || ""), currentLang));
  } else {
    const indexMap = new Map(allSongs.map((s, i) => [s.id, i]));
    sorted.sort((a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0));
  }
  
  return sorted;
}

function applyFilters(opts = {}) {
  const filtered = filterSongs();
  filteredSongs = sortSongs(filtered);
  visibleCount = 20;
  renderSongList();

  const collapse = !!opts.collapseToList;
  const isMobile = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
  if (collapse && isMobile) {
    const details = document.querySelector('.filters-collapse');
    if (details) details.open = false;
    document.body.classList.remove('mobile-show-detail');
    document.body.classList.add('mobile-show-list');
    const listPane = document.querySelector('#list-pane');
    if (listPane) listPane.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ===== Render list =====
function renderSongList() {
  const grid = $("#song-grid");
  const countEl = $("#song-count");
  const hint = $("#list-hint");
  const subtitle = $("#results-subtitle");
  const loadMoreBtn = $("#load-more-btn");

  grid.innerHTML = "";
  countEl.textContent = String(filteredSongs.length);

  const showBtnInList = document.querySelector("#show-results-btn");
  if (showBtnInList) {
    showBtnInList.textContent = (currentLang === "ru")
      ? `Показать: ${filteredSongs.length}`
      : `Mostrar: ${filteredSongs.length}`;
    showBtnInList.disabled = filteredSongs.length === 0;
    showBtnInList.style.opacity = filteredSongs.length === 0 ? "0.6" : "1";
  }

  if (filteredSongs.length === 0) {
    subtitle.textContent = t("noMatches");
    hint.textContent = "";
    loadMoreBtn.style.display = "none";
    return;
  }

  const shown = Math.min(visibleCount, filteredSongs.length);
  subtitle.textContent = t("listShowing")(shown, filteredSongs.length);

  filteredSongs.slice(0, shown).forEach(song => {
    const card = document.createElement("div");
    card.className = "song-card";
    card.tabIndex = 0;
    card.dataset.songId = String(song.id);

    const themeTags = (song.themes || []).map(k => themeLabels[k]?.[currentLang] || k);
    const levelTag = (song.level || [])[0] ? [`${(song.level || [])[0]}`] : [];
    const tags = [...levelTag, ...themeTags].slice(0, 5);

    card.innerHTML = `
      <img class="song-card-cover" src="${song.cover || ""}" alt="" loading="lazy" />
      <div class="song-card-info">
        <h4>${escapeHtml(songTitle(song))}</h4>
        <p>${escapeHtml(song.artist || "")}</p>
        <div class="song-card-tags">${tags.map(x => `<span>${escapeHtml(x)}</span>`).join("")}</div>
      </div>
    `;

    // Открываем страницу песни при клике
    card.addEventListener("click", () => {
      window.location.href = `song.html?id=${song.id}`;
    });
    
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.location.href = `song.html?id=${song.id}`;
      }
    });

    grid.appendChild(card);
  });

  loadMoreBtn.style.display = (shown < filteredSongs.length) ? "block" : "none";
  hint.textContent = t("listShowing")(shown, filteredSongs.length);
}

// ===== Mobile toggle =====
function setupMobileToggle() {
  $$(".mobile-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (view === "list") {
        document.body.classList.add("mobile-show-list");
        document.body.classList.remove("mobile-show-detail");
      } else {
        document.body.classList.add("mobile-show-detail");
        document.body.classList.remove("mobile-show-list");
      }
    });
  });
}

// ===== Scroll to top =====
function setupScrollTop() {
  const scrollBtn = document.getElementById('scrollTop');
  if (!scrollBtn) return;
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      scrollBtn.classList.add('visible');
    } else {
      scrollBtn.classList.remove('visible');
    }
  });
  
  scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  // Hide loader after everything is ready
  setTimeout(hideLoader, 500);
  
  // controls
  const langSelect = $("#language-select");
  langSelect.value = currentLang;

  langSelect.addEventListener("change", () => {
    currentLang = langSelect.value;
    localStorage.setItem("lang", currentLang);
    applyLanguage();
    applyFilters();
  });

  // ===== debounced функция для автоматического применения фильтров =====
  let filterTimeout;
  const debouncedApplyFilters = () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => applyFilters(), 400);
  };

  // Применяем debounced ко всем полям фильтров
  $("#main-search").addEventListener("input", debouncedApplyFilters);
  $("#level-select").addEventListener("change", debouncedApplyFilters);
  $("#culture-select").addEventListener("change", debouncedApplyFilters);
  $("#exclude-16plus").addEventListener("change", debouncedApplyFilters);
  $("#exclude-otherlang").addEventListener("change", debouncedApplyFilters);

  // Кнопка "Применить"
  $("#apply-filters").addEventListener("click", () => applyFilters({ collapseToList: true }));

  // Кнопка "Сбросить"
  $("#clear-filters").addEventListener("click", () => {
    $("#main-search").value = "";
    $("#level-select").value = "";
    $("#culture-select").value = "";
    $("#exclude-16plus").checked = false;
    $("#exclude-otherlang").checked = false;
    applyFilters({ collapseToList: true });
  });

  const showResults = () => {
    const details = document.querySelector('.filters-collapse');
    if (details) details.open = false;
    document.body.classList.remove('mobile-show-detail');
    document.body.classList.add('mobile-show-list');
    const listPane = document.querySelector('#list-pane');
    if (listPane) listPane.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const showBtn = document.querySelector("#show-results-btn");
  if (showBtn) showBtn.addEventListener("click", showResults);

  const resultsClick = document.querySelector("#results-click");
  if (resultsClick) resultsClick.addEventListener("click", showResults);

  // Сортировка
  $("#sort-select").addEventListener("change", () => {
    filteredSongs = sortSongs(filteredSongs);
    visibleCount = 20;
    renderSongList();
  });

  $("#load-more-btn").addEventListener("click", () => {
    visibleCount += 20;
    renderSongList();
  });

  setupMobileToggle();
  setupScrollTop();

  // Mobile: start with filters collapsed so the list is visible
  const detailsOnLoad = document.querySelector('.filters-collapse');
  const isMobileOnLoad = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
  if (detailsOnLoad && isMobileOnLoad) detailsOnLoad.open = false;

  buildSelectOptions();
  applyLanguage();
  applyFilters();
});
