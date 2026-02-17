/* ===== Whac-a-Word Game ===== */
.whackaword-container {
  background: #f8fafc;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid var(--border);
}

.game-header {
  display: flex;
  justify-content: space-between;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 15px;
  padding: 10px;
  background: white;
  border-radius: 12px;
  border: 1px solid var(--border);
}

.game-area {
  position: relative;
  height: 300px;
  background: #eef2f6;
  border-radius: 16px;
  border: 2px dashed var(--border);
  margin-bottom: 15px;
  overflow: hidden;
}

.whackaword-word {
  position: absolute;
  padding: 10px 15px;
  background: var(--accent);
  color: white;
  border-radius: 30px;
  font-weight: 600;
  font-size: 18px;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  transition: transform 0.1s, background 0.1s;
  animation: pop-in 0.2s ease-out;
}

.whackaword-word.clicked {
  opacity: 0;
  pointer-events: none;
}

.whackaword-word:hover {
  transform: scale(1.1);
  background: #1a5fcc;
}

@keyframes pop-in {
  0% { transform: scale(0); opacity: 0; }
  80% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.start-game-btn {
  display: block;
  width: 100%;
  padding: 12px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 30px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.start-game-btn:hover {
  background: #1a5fcc;
}

.game-message {
  margin-top: 15px;
  text-align: center;
}

.win-message {
  color: #10b981;
  font-weight: 600;
  font-size: 18px;
}

.lose-message {
  color: #ef4444;
  font-weight: 600;
  font-size: 18px;
}
