const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function stomach_Q3() {
  const flex = MessageBuilder({
    altText: '【質問3】お腹の働きについて',
    header: '【Q3】お腹の働きについて',
    body: `Q3：お腹の働きについて当てはまるのは？\n\nA：口が渇く／唇が荒れる／便が硬い\nB：食欲はあまりない／軟便・下痢ぎみ\nC：どちらも特にない`,
    buttons: [
      { label: 'A', data: 'stomach_Q3_A' },
      { label: 'B', data: 'stomach_Q3_B' },
      { label: 'C', data: 'stomach_Q3_C' },
    ],
  });

  return flex;
};
