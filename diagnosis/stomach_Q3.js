const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async (userId, client) => {
  const flex = MessageBuilder({
    altText: '【Q3】お腹の働きについて',
    header: 'Q3：お腹の働きについて当てはまるのは？',
    body: `以下のうち、最も当てはまるものを選んでください。\n\nA：口が渇く／唇が荒れる／便が硬い\nB：食欲なし／軟便・下痢ぎみ\nC：どちらもない`,
    buttons: [
      { label: 'A', data: 'stomach_Q3_A' },
      { label: 'B', data: 'stomach_Q3_B' },
      { label: 'C', data: 'stomach_Q3_C' },
    ],
  });

  await client.pushMessage(userId, flex);
};
