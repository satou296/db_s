const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// --- ゲーム設定 ---
const MIN_PLAYERS = 2; // 最小人数
const MAX_PLAYERS = 4; // 最大人数

// ゲームの状態を管理する変数（1つにまとめました）
let gameState = {
  status: 'waiting', // 'waiting' (待機中) または 'playing' (試合中)
  players: {},       // 参加しているプレイヤー情報
  deck: [],          // 山札
  discardPile: [],   // 捨て札
};

// --- Webサーバーの設定 ---
// publicフォルダの中身（HTMLなど）を公開する
app.use(express.static('public'));

// --- 通信の処理 ---
io.on('connection', (socket) => {
  // --- 1. 入室チェック ---
  if (gameState.status === 'playing') {
    socket.emit('join_error', 'すでにゲームが始まっています。');
    socket.disconnect();
    return;
  }

  const currentPlayerCount = Object.keys(gameState.players).length;
  if (currentPlayerCount >= MAX_PLAYERS) {
    socket.emit('join_error', '部屋が満員です。');
    socket.disconnect();
    return;
  }

  // --- 2. 入室処理 ---
  gameState.players[socket.id] = {
    id: socket.id,
    hand: []
  };

  console.log(`プレイヤー入室: ${socket.id} (現在 ${currentPlayerCount + 1}人)`);
  io.emit('lobby_update', Object.keys(gameState.players).length);

  // --- 3. ゲーム開始要求を受け取った時 ---
  socket.on('start_game_request', () => {
    if (gameState.status !== 'waiting') return;

    const count = Object.keys(gameState.players).length;
    if (count < MIN_PLAYERS) {
      socket.emit('join_error', '2人以上揃わないと開始できません。');
      return;
    }

    // ゲーム開始！
    gameState.status = 'playing';
    
    // デッキを生成してシャッフル
    gameState.deck = shuffleDeck(createDeck());
    console.log(`ゲーム開始！ 山札の枚数: ${gameState.deck.length}枚`);
    
    io.emit('game_started');
  });

  // --- 4. 切断時の処理 ---
  socket.on('disconnect', () => {
    if (gameState.players[socket.id]) {
      delete gameState.players[socket.id];
      console.log(`プレイヤー退室: ${socket.id}`);
      
      if (gameState.status === 'waiting') {
        io.emit('lobby_update', Object.keys(gameState.players).length);
      }
      
      if (gameState.status === 'playing' && Object.keys(gameState.players).length < MIN_PLAYERS) {
        // 対戦相手がいなくなったので強制終了（必要に応じて実装）
        console.log('人数が足りなくなったためゲームを終了します');
        gameState.status = 'waiting';
        gameState.deck = [];
        gameState.players = {}; // 全員退出させるか、状態をリセットするかは後々調整
      }
    }
  });
});

// --- デッキ関連の関数 ---
function createDeck() {
  const colors = ['red', 'yellow', 'green', 'blue'];
  const deck = [];
  for (const color of colors) {
    deck.push({ color: color, type: 'number', value: 0 });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color: color, type: 'number', value: i });
      deck.push({ color: color, type: 'number', value: i });
    }
    const actions = ['skip', 'reverse', 'draw2'];
    for (const action of actions) {
      deck.push({ color: color, type: 'action', value: action });
      deck.push({ color: color, type: 'action', value: action });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', type: 'wild', value: 'wild' });
    deck.push({ color: 'wild', type: 'wild', value: 'draw4' });
  }
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// --- サーバーの起動 ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました`);
});