// song.js - Упрощенная версия для проверки
console.log("🚀 song.js загружен");

// ===== Состояние =====
let currentLang = localStorage.getItem("lang") || "ru";
let currentSong = null;

// ===== Вспомогательные функции =====
const $ = (id) => document.getElementById(id);

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.style.display = 'none', 300);
  }
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

// ===== Получение ID песни из URL =====
function getSongIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  console.log("ID из URL:", id);
  return id ? parseInt(id, 10) : null;
}

// ===== Загрузка песни =====
function loadSong() {
  console.log("🎵 loadSong начат");
  
  // Проверяем данные
  console.log("window.songsDataFromExternal:", window.songsDataFromExternal);
  
  if (!window.songsDataFromExternal || !Array.isArray(window.songsDataFromExternal)) {
    console.error("❌ Данные не загружены!");
    showError("Данные не загружены");
    return;
  }
  
  console.log("✅ Данные загружены, песен:", window.songsDataFromExternal.length);
  
  const songId = getSongIdFromUrl();
  if (!songId) {
    console.error("❌ Нет ID в URL");
    showNotFound();
    return;
  }
  
  // Ищем песню
  const song = window.songsDataFromExternal.find(s => s.id === songId);
  console.log("🔍 Найденная песня:", song);
  
  if (!song) {
    console.error("❌ Песня не найдена");
    showNotFound();
    return;
  }
  
  console.log("✅ Песня найдена, рендерим...");
  currentSong = song;
  renderSong();
}

function showError(message) {
  const notFound = document.getElementById('not-found');
  if (notFound) {
    notFound.style.display = 'block';
    notFound.innerHTML = `
      <i class="fas fa-exclamation-triangle" style="font-size: 60px; color: red; margin-bottom: 20px;"></i>
      <h2>Ошибка</h2>
      <p>${message}</p>
      <p style="color: #666; font-size: 12px;">Проверьте консоль (F12)</p>
      <a href="./index.html" class="back-link" style="margin-top: 20px;">Вернуться в каталог</a>
    `;
  }
  hideLoader();
}

function showNotFound() {
  const notFound = document.getElementById('not-found');
  if (notFound) {
    notFound.style.display = 'block';
  }
  hideLoader();
}

function renderSong() {
  console.log("🎨 Рендерим песню:", currentSong);
  
  // Заполняем заголовки
  document.getElementById('song-title').textContent = safeText(currentSong.title);
  document.getElementById('song-artist').textContent = currentSong.artist || '';
  
  // Видео
  if (currentSong.youtubeId) {
    document.getElementById('video-iframe').src = youtubeEmbedUrl(currentSong.youtubeId);
    document.getElementById('youtube-link').href = `https://www.youtube.com/watch?v=${currentSong.youtubeId}`;
  }
  
  // Текст песни (упрощенно)
  const lyricsDiv = document.getElementById('lyrics-content');
  if (currentSong.lyrics && currentSong.lyrics.length > 0) {
    lyricsDiv.innerHTML = currentSong.lyrics.map(l => `<p>${l.text}</p>`).join('');
  } else {
    lyricsDiv.innerHTML = '<p>Текст пока не добавлен</p>';
  }
  
  // Показываем контент
  document.getElementById('song-content').style.display = 'block';
  hideLoader();
  
  console.log("✅ Рендер завершен");
}

// Запускаем
document.addEventListener('DOMContentLoaded', () => {
  console.log("📅 DOM загружен");
  loadSong();
});
