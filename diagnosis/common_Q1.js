const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q1() {
  const flex = MessageBuilder({
    altText: '【質問1】ここ数年間の体力傾向',
    header: '【Q1】体力ベースの傾向',
    body: `Q1：ここ数年間の体力の傾向で、最も近いものはどれですか？\n\nA：少し無理するとぐったり疲れ、回復に時間がかかる\n\nB：比較的体力には余裕があり、回復も早い\n\nC：疲れはするが、十分休めば回復する`,
    buttons: [
      { label: 'A', data: 'common_Q1_A' },
      { label: 'B', data: 'common_Q1_B' },
      { label: 'C', data: 'common_Q1_C' },
    ],
  });

  return flex;
};
