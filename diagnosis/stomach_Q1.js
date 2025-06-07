const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function stomach_Q1() {
  const flex = MessageBuilder({
altText: '【質問1】ここ数年間の体力傾向',
    header: '【Q1】ここ数年間の体力傾向（共通質問）',
    body: `Q1：風邪（インフルエンザ等強い感染症除く）をひいた時、あなたに多いパターンは？\n\nA：軽い症状で長引く／ダラダラ治りきらない\nB：ガッと発症してもすぐ治る／滅多に風邪はひかない（特別な対策なし）\nC：時と場合による／特に傾向はない`,
    buttons: [
      { label: 'A', data: 'stomach_Q1_A' },
      { label: 'B', data: 'stomach_Q1_B' },
      { label: 'C', data: 'stomach_Q1_C' },
    ],
  });

  return flex;
};
