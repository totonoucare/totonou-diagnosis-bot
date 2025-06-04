const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q5() {
  const flex = MessageBuilder({
    altText: '【質問5】体の違和感・張り感がある動き',
    header: '【Q5】体の違和感・張り感がある動き',
    body: `Q5：次の動作の中で、体の違和感や張り感を最も感じるのはどれですか？\nA：首を左右に回す\nB：腕をバンザイする\nC：前屈する\nD：腰を左右にねじる\nE：上体をそらす`,
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
