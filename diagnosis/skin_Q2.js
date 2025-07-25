const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function skin_Q2() {
  const flex = MessageBuilder({
    altText: '【質問2】頭皮や肌のトラブルの傾向',
    header: '【Q2】肌・頭皮の冷えや熱',
    body: `Q2：次のうち、当てはまる状態をより多く（または強く）含む選択肢はどれですか？\n\nA：冷えると悪化／冬場や冷房が苦手\n\nB：赤み・ほてり／かゆみ／夏や入浴後に悪化\n\nC：特に偏りはない`,
    buttons: [
      { label: 'A', data: 'skin_Q2_A' },
      { label: 'B', data: 'skin_Q2_B' },
      { label: 'C', data: 'skin_Q2_C' },
    ],
  });

  return flex;
};
