const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function pollen_Q1() {
  const flex = MessageBuilder({
    altText: '【質問1】風邪をひいた時のパターン',
    header: '【Q1】風邪のときの傾向',
    body: `Q1：風邪（インフルエンザ等強い感染症除く）をひいた時、あなたに多いパターンはどちらですか？\n\nA：長引きやすい・微熱くらいでグズグズ\nB：高熱が出る・喉や鼻の炎症が強い\nC：その時々で違う`,
    buttons: [
      { label: 'A', data: 'pollen_Q1_A' },
      { label: 'B', data: 'pollen_Q1_B' },
      { label: 'C', data: 'pollen_Q1_C' },
    ],
  });

  return flex;
};
