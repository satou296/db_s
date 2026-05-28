const { createDeck, shuffleDeck, isPlayable } = require('./gameLogic');

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
  turnOrder: [],       // プレイヤーの順番（socket.idの配列）
  currentTurnIndex: 0, // 現在、配列の何番目の人のターンか
  direction: 1         // 1なら時計回り、-1なら反時計回り（リバース用）
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
    
    // ★ターンの初期設定
    gameState.turnOrder = playerIds; 
    gameState.currentTurnIndex = 0; // 0番目の人からスタート
    gameState.direction = 1;        // 時計回り

    // 全員に7枚ずつカードを配る
    for (let i = 0; i < 7; i++) {
      for (const pid of playerIds) {
        const card = gameState.deck.pop(); 
        gameState.players[pid].hand.push(card);
      }
    }

    // 山札から1枚めくって、最初の捨て札にする
    const firstCard = gameState.deck.pop();
    gameState.discardPile.push(firstCard);

    // ★修正：最初のターンが誰かを判定しつつ、全員に「ゲーム開始」を送る
    const currentTurnPlayerId = gameState.turnOrder[gameState.currentTurnIndex];

    for (const pid of playerIds) {
      const myHand = gameState.players[pid].hand;
      
      // ★エラーの原因解決：ここで isMyTurn を定義してあげる
      const isMyTurn = (pid === currentTurnPlayerId);
      
      io.to(pid).emit('game_started', {
        hand: myHand,
        topCard: firstCard,
        isMyTurn: isMyTurn
      });
    }
  });

  // --- 5. プレイヤーがカードを出そうとした時 ---
  socket.on('play_card', (cardIndex) => {
    if (gameState.status !== 'playing') return;

    const player = gameState.players[socket.id];
    
    // 出そうとしているカードと、現在の一番上の場のカードを取得
    const playedCard = player.hand[cardIndex];
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];

    // ルールチェック
    if (isPlayable(playedCard, topCard)) {
      // 出せる場合：手札から消して、捨て札の山に追加する
      player.hand.splice(cardIndex, 1);
      gameState.discardPile.push(playedCard);

      //ターンを次の人に回す
      // (現在のインデックス + 方向 + 人数) % 人数 で、最後の人の次は最初の人に戻るように計算します
      const numPlayers = gameState.turnOrder.length;
      gameState.currentTurnIndex = (gameState.currentTurnIndex + gameState.direction + numPlayers) % numPlayers;

      // 全員に「画面を更新して！」と最新情報を送る
      sendGameState();
    } else {
      // 出せない場合：その人にだけエラーを送る
      socket.emit('action_error', 'そのカードは出せません！');
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

// 現在参加している全員に、それぞれの最新データを送る関数
function sendGameState() {
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];
  const currentTurnPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
  
  for (const pid of Object.keys(gameState.players)) {
    const myHand = gameState.players[pid].hand;
    
    // この人が現在のターンの人かチェック
    const isMyTurn = (pid === currentTurnPlayerId); 

    io.to(pid).emit('update_game_state', {
      hand: myHand,
      topCard: topCard,
      isMyTurn: isMyTurn
    });
  }
}

// --- サーバーの起動 ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました`);
});