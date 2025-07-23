const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function skin_Q4() {
  const flex = MessageBuilder({
    altText: '【質問4】肌・頭皮の不調傾向',
    header: '【Q4】肌・頭皮の不調の特徴と傾向',
    body: `Q4：次のうち、当てはまる状態をより多く（または強く）含む選択肢はどれですか？\n\nA：ストレスで悪化／気分によって波がある\n\nB：ベタつき／吹き出物／重だるさ\n\nC：目の下のクマ／しみ・くすみ／部分的な抜け毛\n\nD：特に当てはまらない`,
    buttons: [
      { label: 'A', data: 'skin_Q4_A' },
      { label: 'B', data: 'skin_Q4_B' },
      { label: 'C', data: 'skin_Q4_C' },
      { label: 'D', data: 'skin_Q4_D' },
    ],
  });

  return flex;
};
