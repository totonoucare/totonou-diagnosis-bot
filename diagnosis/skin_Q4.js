const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function skin_Q4() {
  const flex = MessageBuilder({
    altText: '【質問4】肌・頭皮の不調傾向',
    header: '【Q4】不調の特徴と傾向',
    body: `Q4：肌・頭皮の不調に関して、当てはまるのは？\n\nA：ストレスや月経前(女性)に悪化\nB：ベタつき・吹き出物・重だるさ\nC：目の下のクマ／しみ・くすみ／部分的な抜け毛\nD：特に当てはまらない`,
    buttons: [
      { label: 'A', data: 'skin_Q4_A' },
      { label: 'B', data: 'skin_Q4_B' },
      { label: 'C', data: 'skin_Q4_C' },
      { label: 'D', data: 'skin_Q4_D' },
    ],
  });

  return flex;
};
