const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q5() {
  const flex = MessageBuilder({
    altText: '【質問5】経絡（内臓）の状態',
    header: '【Q5】経絡（けいらく）ラインの負荷テスト',
    body: `Q5：次の動作を行ったとき、最も違和感・張り・ツラさを感じやすいものをお選びください。\n（※複数ある場合は、よりツラいものをお選びください）\n\nA：首を後ろに倒す・横(左右)を向く\n\nB：腕をバンザイ・首をうつむける\n\nC：立ったまま前屈する\n\nD：腰を左右にひねる・体を横に倒す\n\nE：腰に手を当てて上体を反らす`,
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
