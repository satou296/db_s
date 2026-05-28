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

function renderGame(data) {
  // ターン表示の切り替え
  const turnIndicator = document.getElementById('turn-indicator');
  if (data.isMyTurn) {
    turnIndicator.textContent = 'あなたのターンです！カードを出してください。';
    turnIndicator.style.backgroundColor = '#ffeb3b'; // 目立つ黄色
    turnIndicator.style.color = 'black';
  } else {
    turnIndicator.textContent = '相手のターンを待っています...';
    turnIndicator.style.backgroundColor = '#95a5a6'; // 待機っぽいグレー
    turnIndicator.style.color = 'white';
  }

  const handContainer = document.getElementById('my-hand');
  handContainer.innerHTML = ''; 

  // 何番目のカードか（index）を取得できるようにする
  data.hand.forEach((cardData, index) => {
    // カードをクリックできるようにする
    const cardElement = createCardElement(cardData);
    cardElement.style.cursor = 'pointer';
    
    // クリック処理を修正
    cardElement.addEventListener('click', () => {
      // 自分のターンじゃない時は送信せず、その場で弾く
      if (!data.isMyTurn) {
        alert('今は相手のターンです！');
        return;
      }
      // サーバーへ「〇番目のカードを出したい」と送信する
      socket.emit('play_card', index);
    });

    handContainer.appendChild(cardElement);
  });
  // 場のカード（捨て札）の表示
  const discardContainer = document.getElementById('discard-pile');
  discardContainer.innerHTML = '';
  const topCardElement = createCardElement(data.topCard);
  discardContainer.appendChild(topCardElement);
}

// ゲーム開始時
socket.on('game_started', (data) => {
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('game-board').style.display = 'block';
  renderGame(data); // 描画関数を呼び出す
});

// 誰かがカードを出して、画面を更新する時
socket.on('update_game_state', (data) => {
  renderGame(data);
});

// ルール違反のカードを出そうとした時のエラー
socket.on('action_error', (msg) => {
  alert(msg); // ブラウザのポップアップで警告
});

// カードのHTML（見た目）を作成する便利関数
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