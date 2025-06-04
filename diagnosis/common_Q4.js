const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q4() {
  const flex = MessageBuilder({
    altText: '【質問4】日中〜夕方の不調',
    header: '【Q4】日中〜夕方の不調',
    body: `Q4：日中〜夕方にかけて感じやすい不調はどれですか？\n\nA：胸・お腹の張り／ため息／感情が詰まる\nB：食後の眠気／頭が重い／体がだるい\nC：決まった部位の痛み／夜に悪化／クマ・しみが気になる\nD：特に当てはまらない。`,
    buttons: [
      { label: 'A', data: 'common_Q4_A' },
      { label: 'B', data: 'common_Q4_B' },
      { label: 'C', data: 'common_Q4_C' },
      { label: 'D', data: 'common_Q4_D' },
    ],
  });

  return flex;
};
