const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function stomach_Q1() {
  const flex = MessageBuilder({
    altText: '【質問1】食事の量について',
    header: '【Q1】食事の量について',
    body: `Q1：食事の量はどちらに近いですか？\n\nA：少食で満腹になりやすい\nB：しっかり食べる方\nC：日によって差がある`,
    buttons: [
      { label: 'A', data: 'stomach_Q1_A' },
      { label: 'B', data: 'stomach_Q1_B' },
      { label: 'C', data: 'stomach_Q1_C' },
    ],
  });

  return flex;
};
