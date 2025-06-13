const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q5() {
  const flex = MessageBuilder({
    altText: '【質問5】経絡（内臓）の状態',
    header: '【Q5】経絡（けいらく）・内臓の負担',
    body: `Q5：次の動作のうち、体のどこかに一番違和感やツラさを感じる動作を選んでください。\n\nA：首を後ろに倒すor左右に回す\nB：腕をバンザイする\nC：前屈する\nD：腰を左右にねじるor側屈\nE：上体をそらす`,
    buttons: [
      { label: 'A', data: 'common_Q5_A' },
      { label: 'B', data: 'common_Q5_B' },
      { label: 'C', data: 'common_Q5_C' },
      { label: 'D', data: 'common_Q5_D' },
      { label: 'E', data: 'common_Q5_E' },
    ],
  });

  return flex;
};
