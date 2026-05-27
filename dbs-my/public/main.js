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
  // ロビー画面を隠して、ゲーム画面を表示する
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('game-board').style.display = 'block';

  // 手札を並べるエリア（<div id="my-hand">）を取得し、中身を一旦空にする
  const handContainer = document.getElementById('my-hand');
  handContainer.innerHTML = ''; 

  // 受け取った手札データ（7枚分）をループ処理して、1枚ずつ画面に作る
  myHand.forEach((cardData) => {
    // 新しい <div> を作成
    const cardElement = document.createElement('div');
    
    // CSSのクラス名を追加して、色をつける (例: "card red")
    cardElement.className = `card ${cardData.color}`;
    
    // 画面に表示する文字を設定（特殊カードは分かりやすい文字に変換）
    let displayText = cardData.value;
    if (cardData.value === 'draw2') displayText = '+2';
    if (cardData.value === 'draw4') displayText = '+4';
    if (cardData.value === 'skip') displayText = 'Skip';
    if (cardData.value === 'reverse') displayText = 'Rev';
    if (cardData.value === 'wild') displayText = 'Wild';
    
    cardElement.textContent = displayText;

    // 作ったカードを画面（handContainer）に追加する
    handContainer.appendChild(cardElement);
  });
});