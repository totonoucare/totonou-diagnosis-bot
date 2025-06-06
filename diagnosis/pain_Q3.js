const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function pain_Q3() {
  const flex = MessageBuilder({
    altText: '【質問3】疲れ方・回復のしやすさ',
    header: '【Q3】疲労感と回復傾向',
    body: `Q3：次のうち、当てはまる状態をより多く（または強く）含む選択肢はどれですか？\n\nA：筋肉がつきにくい／回復が遅い／皮膚や髪が乾燥\nB：疲れやすい／だるさが抜けにくい\nC：どちらもあまり当てはまらない`,
    buttons: [
      { label: 'A', data: 'pain_Q3_A' },
      { label: 'B', data: 'pain_Q3_B' },
      { label: 'C', data: 'pain_Q3_C' },
    ],
  });

  return flex;
};
