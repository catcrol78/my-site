// song.js
console.log("song.js загружен");

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

// Получаем ID из URL
const urlParams = new URLSearchParams(window.location.search);
const songId = parseInt(urlParams.get('id'));

// Ждем загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM загружен, ищем песню с ID:", songId);
  
  // Проверяем данные
  if (!songsDataFromExternal) {
    alert('Ошибка: данные не загружены!');
    return;
  }
  
  // Ищем песню
  const song = songsDataFromExternal.find(s => s.id === songId);
  
  if (!song) {
    $('not-found').style.display = 'block';
    hideLoader();
    return;
  }
  
  console.log("Песня найдена:", song);
  
  // Заполняем информацию
  $('song-title').textContent = safeText(song.title);
  $('song-artist').textContent = song.artist || '';
  
  // Видео
  if (song.youtubeId) {
    $('video-iframe').src = `https://www.youtube.com/embed/${song.youtubeId}`;
  }
  
  // Текст песни
  const lyricsDiv = $('lyrics-content');
  if (song.lyrics && song.lyrics.length) {
    lyricsDiv.innerHTML = song.lyrics.map(l => `<p>${l.text}</p>`).join('');
  } else {
    lyricsDiv.innerHTML = '<p>Текст пока не добавлен</p>';
  }
  
  // Лексика
  const vocabDiv = $('vocab-content');
  if (song.vocabulary && song.vocabulary.length) {
    vocabDiv.innerHTML = song.vocabulary.map(w => 
      `<span style="border:1px solid #e5e7eb; border-radius:30px; padding:8px 10px; background:white;">${w}</span>`
    ).join('');
  }
  
  // Задания
  const tasksDiv = $('tasks-container');
  if (song.tasks && song.tasks.length) {
    tasksDiv.innerHTML = song.tasks.map(t => `
      <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:16px; padding:20px; margin-bottom:10px;">
        <h3>${safeText(t.title)}</h3>
        <p>${safeText(t.instruction)}</p>
        <p>${t.content || ''}</p>
      </div>
    `).join('');
  } else {
    tasksDiv.innerHTML = '<p>Заданий пока нет</p>';
  }
  
  // Бейджи
  const badgesDiv = $('song-badges');
  const badges = [];
  if (song.level) badges.push(`<span class="badge"><i class="fas fa-signal"></i> ${song.level.join(', ')}</span>`);
  if (song.themes) song.themes.forEach(t => badges.push(`<span class="badge"><i class="fas fa-tag"></i> ${t}</span>`));
  if (song.grammar) song.grammar.forEach(g => badges.push(`<span class="badge"><i class="fas fa-language"></i> ${g}</span>`));
  badgesDiv.innerHTML = badges.join('');
  
  // Показываем контент
  $('song-content').style.display = 'block';
  hideLoader();
});
