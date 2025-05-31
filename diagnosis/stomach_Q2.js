const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async (userId, client) => {
  const flex = MessageBuilder({
    altText: '【Q2】お腹の不調が強くなるのは？',
    header: 'Q2：お腹の不調が強くなるのは？',
    body: `次のうち、最も当てはまるものを選んでください。\n\nA：冷たい飲食／冷房で悪化\nB：油っこいもの／胃が熱い感じ\nC：特にどちらもない`,
    buttons: [
      { label: 'A', data: 'stomach_Q2_A' },
      { label: 'B', data: 'stomach_Q2_B' },
      { label: 'C', data: 'stomach_Q2_C' },
    ],
  });

  await client.pushMessage(userId, flex);
};
