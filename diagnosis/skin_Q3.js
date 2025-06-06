const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function skin_Q3() {
  const flex = MessageBuilder({
    altText: '【質問3】髪や肌の状態',
    header: '【Q3】髪や肌、体力の変化',
    body: `Q3：次のうち、当てはまる状態をより多く（または強く）含む選択肢はどれですか？\n\nA：髪がパサつく／抜けやすい／肌がくすむ\nB：疲れやすい／息切れ／顔色が白くハリがない\nC：特に気になる変化はない`,
    buttons: [
      { label: 'A', data: 'skin_Q3_A' },
      { label: 'B', data: 'skin_Q3_B' },
      { label: 'C', data: 'skin_Q3_C' },
    ],
  });

  return flex;
};
