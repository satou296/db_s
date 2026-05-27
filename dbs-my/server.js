const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

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