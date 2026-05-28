// gameLogic.js

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

// 場に出せるカードかどうかを判定する関数
function isPlayable(playedCard, topCard) {
  // ワイルドカード（黒）はいつでも出せる
  if (playedCard.color === 'wild') return true;
  // 色が同じなら出せる
  if (playedCard.color === topCard.color) return true;
  // 数字や記号（スキップなど）が同じなら出せる
  if (playedCard.value === topCard.value) return true;
  
  // 上記のどれにも当てはまらない場合は出せない
  return false;
}

// ここが重要！他のファイルから呼び出せるように「公開」する
module.exports = {
  createDeck,
  shuffleDeck,
  isPlayable
};