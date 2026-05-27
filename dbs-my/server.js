const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
//ゲーム進行に必要な関数
// サーバー側 (server.js) の上部に定義する
const MIN_PLAYERS = 2; // 最小人数
const MAX_PLAYERS = 4; // 最大人数

// publicフォルダの中身（HTMLなど）を公開する設定
app.use(express.static('public'));

// プレイヤーが接続してきたときの処理
io.on('connection', (socket) => {
  console.log('プレイヤーが接続しました: ' + socket.id);

  // プレイヤーから「chat message」というデータを受け取ったときの処理
  socket.on('chat message', (msg) => {
    console.log('受け取ったメッセージ: ' + msg);
    // 接続している全員に同じメッセージを送信（反射）する
    io.emit('chat message', msg);
  });

  // プレイヤーが切断したときの処理
  socket.on('disconnect', () => {
    console.log('プレイヤーが切断しました');
  });
});

// PaaSで動かすための重要な設定（環境変数PORTを使う）
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました`);
});

let gameState = {
  status: 'waiting', // 'waiting' (待機中) または 'playing' (試合中)
  players: {},       // 参加しているプレイヤー情報
  // ...その他の状態 (deck, discardPile など)
};

io.on('connection', (socket) => {
  
  // --------------------------------------------------
  // 1. 接続時の入室チェック
  // --------------------------------------------------
  
  // すでに試合中の場合
  if (gameState.status === 'playing') {
    socket.emit('join_error', 'すでにゲームが始まっています。');
    socket.disconnect(); // 通信を強制切断する
    return;
  }

  // すでに4人（満員）の場合
  const currentPlayerCount = Object.keys(gameState.players).length;
  if (currentPlayerCount >= MAX_PLAYERS) {
    socket.emit('join_error', '部屋が満員です。');
    socket.disconnect();
    return;
  }

  // --- ここまで来たら入室成功 ---
  
  // プレイヤーを登録する
  gameState.players[socket.id] = {
    id: socket.id,
    hand: [] // 手札は最初は空っぽ
  };

  console.log(`プレイヤー入室: ${socket.id} (現在 ${currentPlayerCount + 1}人)`);

  // 全員に現在の人数やメンバーを知らせる
  io.emit('lobby_update', Object.keys(gameState.players).length);

  // --------------------------------------------------
  // 2. 切断時（ブラウザを閉じた時など）の処理
  // --------------------------------------------------
  socket.on('disconnect', () => {
    // もし入室していたプレイヤーなら、リストから削除する
    if (gameState.players[socket.id]) {
      delete gameState.players[socket.id];
      console.log(`プレイヤー退室: ${socket.id}`);
      
      // 待機中なら、残った人に最新の人数を知らせる
      if (gameState.status === 'waiting') {
        io.emit('lobby_update', Object.keys(gameState.players).length);
      }
      
      // もし試合中に誰かが抜けて、1人以下になってしまったらゲームを強制終了する
      if (gameState.status === 'playing' && Object.keys(gameState.players).length < MIN_PLAYERS) {
        io.emit('game_over', '対戦相手が切断したため、ゲームを終了します。');
        resetGame(); // 状態を初期化して待機中に戻す関数（後述）
      }
    }
  });
  
  socket.on('start_game_request', () => {
    // 待機中じゃない場合は無視
    if (gameState.status !== 'waiting') return;

    // 2人未満だったら開始できない
    const count = Object.keys(gameState.players).length;
    if (count < MIN_PLAYERS) {
      socket.emit('error', '2人以上揃わないと開始できません。');
      return;
    }

    // --- ゲーム開始処理 ---
    gameState.status = 'playing'; // ステータスを試合中に変更
    
    // 1. デッキを生成してシャッフル (前回作った処理)
    // gameState.deck = shuffleDeck(createDeck());
    
    // 2. プレイヤー全員に7枚ずつカードを配る処理など...
    
    // 全員にゲーム開始を知らせる！
    io.emit('game_started');
  });

});



//デッキ作成
function createDeck() {
  const colors = ['red', 'yellow', 'green', 'blue'];
  const deck = [];

  // 1. 色付きのカード（数字とアクション）を生成
  for (const color of colors) {
    // 『0』のカード（各色1枚のみ）
    deck.push({ color: color, type: 'number', value: 0 });

    // 『1〜9』のカード（各色2枚ずつ）
    for (let i = 1; i <= 9; i++) {
      deck.push({ color: color, type: 'number', value: i });
      deck.push({ color: color, type: 'number', value: i });
    }

    // 『アクション』カード（各色2枚ずつ）
    const actions = ['skip', 'reverse', 'draw2'];
    for (const action of actions) {
      deck.push({ color: color, type: 'action', value: action });
      deck.push({ color: color, type: 'action', value: action });
    }
  }

  // 2. ワイルドカードを生成（色を持たない特殊カード）
  // ワイルドとワイルドドロー4を4枚ずつ
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', type: 'wild', value: 'wild' });
    deck.push({ color: 'wild', type: 'wild', value: 'draw4' });
  }

  return deck;
}

//シャッフル
function shuffleDeck(deck) {
  // 配列の後ろから順番に、ランダムに選んだ別の場所と中身を入れ替えていく
  for (let i = deck.length - 1; i > 0; i--) {
    // 0 から i までのランダムな整数を生成
    const j = Math.floor(Math.random() * (i + 1));
    
    // deck[i] と deck[j] の中身を入れ替える（分割代入という書き方です）
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
// 上記を別ファイルに書いて読み込むことも可能

// ゲームの状態を管理する変数
let gameState = {
  deck: [], // 山札
  discardPile: [], // 捨て札
  // ...その他の状態
};

// ゲーム開始時の処理（またはサーバー起動時）
function startGame() {
  // 1. デッキを生成する
  let newDeck = createDeck();
  
  // 2. 生成したデッキをシャッフルして、gameStateに保存する
  gameState.deck = shuffleDeck(newDeck);
  
  console.log(`ゲーム準備完了！ 山札の枚数: ${gameState.deck.length}枚`);
  
  // （確認用）一番上のカードを1枚見てみる
  // console.log(gameState.deck[0]);
}

// テストとして実行してみる
startGame();