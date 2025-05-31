const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q5() {
  const flex = MessageBuilder({
    altText: '【質問5】どの動作で最も違和感がありますか？',
    header: '【Q5】どの動作で最も違和感がありますか？',
    body: '次の動きの中で、最もツラさや違和感を感じるものを選んでください。',
    buttons: [
      { label: 'A：首を左右に回す（肺・大腸）', data: 'common_Q5_A' },
      { label: 'B：腕をバンザイする（心・小腸）', data: 'common_Q5_B' },
      { label: 'C：前屈する（腎・膀胱）', data: 'common_Q5_C' },
      { label: 'D：腰をねじる（肝・胆）', data: 'common_Q5_D' },
      { label: 'E：上体をそらす（脾・胃）', data: 'common_Q5_E' },
    ],
  });

  return flex;
};
