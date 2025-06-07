const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q1() {
  const flex = MessageBuilder({
    altText: '【質問1】風邪をひいた時のパターン',
    header: '【Q1】風邪をひいた時のパターン',
    body: `Q1：風邪（インフルエンザ等強い感染症除く）をひいた時、あなたに多いパターンは？\n\nA：軽い症状で長引く／だらだらしやすい\nB：ガッと発症してもすぐ治る／あまり風邪をひかない\nC：時と場合による／特に傾向はない`,
    buttons: [
      { label: 'A', data: 'common_Q1_A' },
      { label: 'B', data: 'common_Q1_B' },
      { label: 'C', data: 'common_Q1_C' },
    ],
  });

  return flex;
};
