const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function women_Q3() {
  const flex = MessageBuilder({
    altText: '【質問3】普段の体調や見た目',
    header: '【Q3】日常の体調変化',
    body: `Q3：次のうち、当てはまる状態をより多く（または強く）含む選択肢はどれですか？\n\nA：肌や髪がパサつく／めまい・ふらつき\nB：顔色が白い／疲れやすい／声が小さい\nC：どちらも特にない`,
    buttons: [
      { label: 'A', data: 'women_Q3_A' },
      { label: 'B', data: 'women_Q3_B' },
      { label: 'C', data: 'women_Q3_C' },
    ],
  });

  return flex;
};
