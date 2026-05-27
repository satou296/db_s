const { createDeck, shuffleDeck } = require('./gameLogic');

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

    const playerIds = Object.keys(gameState.players);
    if (playerIds.length < MIN_PLAYERS) {
      socket.emit('join_error', '2人以上揃わないと開始できません。');
      return;
    }

    // ゲーム開始！
    gameState.status = 'playing';
    gameState.deck = shuffleDeck(createDeck());

    // 【追加1】全員に7枚ずつカードを配る（前回のまま）
    for (let i = 0; i < 7; i++) {
      for (const pid of playerIds) {
        const card = gameState.deck.pop(); 
        gameState.players[pid].hand.push(card);
      }
    }

      // ★【新規追加】山札から1枚めくって、最初の捨て札にする
      const firstCard = gameState.deck.pop();
      gameState.discardPile.push(firstCard);

      console.log(`ゲーム開始！ 最初のカードは ${firstCard.color} の ${firstCard.value} です。`);

    // ★【修正】それぞれのプレイヤーに「自分の手札」と「場のカード」の両方を送る
    for (const pid of playerIds) {
      const myHand = gameState.players[pid].hand;
      
      // 複数のデータを送るため、{}（オブジェクト）で包んで送ります
      io.to(pid).emit('game_started', {
        hand: myHand,
        topCard: firstCard
      });
    }
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

// --- サーバーの起動 ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました`);
});