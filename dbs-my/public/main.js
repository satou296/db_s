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

// ゲーム開始と画面の表示
// ※ (data) の中には { hand: [...], topCard: {...} } が入ってきます
socket.on('game_started', (data) => {
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('game-board').style.display = 'block';

  // 1. 手札の表示
  const handContainer = document.getElementById('my-hand');
  handContainer.innerHTML = ''; 
  data.hand.forEach((cardData) => {
    // 下で作った「カードを作る関数」を呼び出す
    const cardElement = createCardElement(cardData);
    handContainer.appendChild(cardElement);
  });

  // 2. 場のカード（捨て札）の表示
  const discardContainer = document.getElementById('discard-pile');
  discardContainer.innerHTML = '';
  const topCardElement = createCardElement(data.topCard);
  discardContainer.appendChild(topCardElement);
});


// ★新規追加：カードのHTML（見た目）を作成する便利関数
function createCardElement(cardData) {
  const cardElement = document.createElement('div');
  cardElement.className = `card ${cardData.color}`;
  
  let displayText = cardData.value;
  if (cardData.value === 'draw2') displayText = '+2';
  if (cardData.value === 'draw4') displayText = '+4';
  if (cardData.value === 'skip') displayText = 'Skip';
  if (cardData.value === 'reverse') displayText = 'Rev';
  if (cardData.value === 'wild') displayText = 'Wild';
  
  cardElement.textContent = displayText;
  
  return cardElement;
}