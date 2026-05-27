// public/main.js
const socket = io();

// ロビーの更新
socket.on('lobby_update', (count) => {
  document.getElementById('player-count').textContent = count;
  document.getElementById('start-btn').disabled = count < 2;
});

// 開始ボタン
document.getElementById('start-btn').addEventListener('click', () => {
  socket.emit('start_game_request');
});

// エラーメッセージ
socket.on('join_error', (msg) => {
  document.getElementById('error-message').textContent = msg;
});

// ゲーム開始と手札の表示
socket.on('game_started', (myHand) => {
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('game-board').style.display = 'block';

  const handContainer = document.getElementById('my-hand');
  handContainer.innerHTML = ''; 

  myHand.forEach((cardData) => {
    const cardElement = document.createElement('div');
    cardElement.className = `card ${cardData.color}`;
    
    let displayText = cardData.value;
    if (cardData.value === 'draw2') displayText = '+2';
    if (cardData.value === 'draw4') displayText = '+4';
    if (cardData.value === 'skip') displayText = 'Skip';
    if (cardData.value === 'reverse') displayText = 'Rev';
    if (cardData.value === 'wild') displayText = 'Wild';
    
    cardElement.textContent = displayText;
    handContainer.appendChild(cardElement);
  });
});