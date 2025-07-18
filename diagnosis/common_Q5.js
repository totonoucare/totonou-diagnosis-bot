const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q5() {
  const flex = MessageBuilder({
    altText: '【質問5】経絡（内臓）の状態',
    header: '【Q5】経絡（内臓膜や筋膜）の負担状況',
    body: `Q5：次の動作をすることで、体のどこかに違和感やツラさを感じる動作を選んでください。\n※複数ある場合は最もツラい動作を選んでください。\n\nA：首を後ろに倒すor左右に回す\n\nB：腕をバンザイする\n\nC：立って前屈する\n\nD：腰を左右にひねるor側屈\n\nE：上体をそらす（腰に手を当て）`,
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
