const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q5() {
  const flex = MessageBuilder({
    altText: '【質問5】経絡（内臓）の状態',
    header: '【Q5】経絡（けいらく）ラインの負担状況',
    body: `Q5：次の動作をすることで、体のどこかに違和感やツラさを感じる動作を選んでください。\n※複数ある場合は最もツラい動作を選んでください。\n\nA：首を後ろに倒す・横(左右)を向く\n\nB：腕をバンザイ・首を俯く\n\nC：前屈する(立った状態で)\n\nD：腰を左右にひねる・側屈する\n\nE：腰に手を当て上体そらし`,
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
