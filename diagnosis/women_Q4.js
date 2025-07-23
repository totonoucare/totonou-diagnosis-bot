const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function women_Q4() {
  const flex = MessageBuilder({
    altText: '【質問4】月経時の体調',
    header: '【Q4】月経と体の反応',
    body: `Q4：月経にまつわる体調で当てはまるのは？\n\nA：月経前に下腹部の張り・胸の違和感・イライラ\n\nB：月経中に下腹が重だるい／眠い・むくむ\n\nC：月経時の強い痛み／塊が出る／経血が暗い\n\nD：どれも特にない`,
    buttons: [
      { label: 'A', data: 'women_Q4_A' },
      { label: 'B', data: 'women_Q4_B' },
      { label: 'C', data: 'women_Q4_C' },
      { label: 'D', data: 'women_Q4_D' },
    ],
  });

  return flex;
};
