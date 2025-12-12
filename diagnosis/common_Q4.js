const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q4() {
  const flex = MessageBuilder({
    altText: '【Q4】巡りの偏り（体内の滞り）について',
    header: '【Q4】巡りの偏り（体内の滞り）について',
    body: `Q4：次のうち、当てはまる状態をより多く（または強く）含む選択肢はどれですか？\n\nA：胸やみぞおちの張り／ため息／気持ちがつまる\n\nB：食後に眠くなる／頭が重い／体が重だるい\n\nC：同じ場所の痛みが続く／夜に症状が重くなる／クマやしみが気になる\n\nD：特に当てはまらない。`,
    buttons: [
      { label: 'A', data: 'common_Q4_A' },
      { label: 'B', data: 'common_Q4_B' },
      { label: 'C', data: 'common_Q4_C' },
      { label: 'D', data: 'common_Q4_D' },
    ],
  });

  return flex;
};
