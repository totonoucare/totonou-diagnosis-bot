const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q4() {
  const flex = MessageBuilder({
    altText: '【Q4】巡りの偏り（体内の滞り）について',
    header: '【Q4】巡りの偏り（体内の滞り）について',
    body: `Q4：次のうち、当てはまる状態をより多く（または強く）含む選択肢はどれですか？\n\nA：胸・お腹の張り／ため息／感情が詰まる\n\nB：食後の眠気／頭が重い／体がだるい\n\nC：決まった部位の痛み／夜に悪化／クマ・しみが気になる\n\nD：特に当てはまらない。`,
    buttons: [
      { label: 'A', data: 'common_Q4_A' },
      { label: 'B', data: 'common_Q4_B' },
      { label: 'C', data: 'common_Q4_C' },
      { label: 'D', data: 'common_Q4_D' },
    ],
  });

  return flex;
};
