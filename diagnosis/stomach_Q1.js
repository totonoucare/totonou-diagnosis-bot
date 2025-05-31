const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async (userId, client) => {
  const flex = MessageBuilder({
    altText: '【Q1】食事の量について',
    header: 'Q1：食事の量について',
    body: `次のうち、あなたの普段の食事の量に近いものを選んでください。\n\nA：少食で満腹になりやすい\nB：しっかり食べる方\nC：日によって差がある`,
    buttons: [
      { label: 'A', data: 'stomach_Q1_A' },
      { label: 'B', data: 'stomach_Q1_B' },
      { label: 'C', data: 'stomach_Q1_C' },
    ],
  });

  await client.pushMessage(userId, flex);
};
