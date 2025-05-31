const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function stomach_Q1() {
  const flex = MessageBuilder({
    altText: '【質問1】食事の量について教えてください',
    header: '【Q1】食事の量について',
    body: `次のうち、あなたの普段の食事の量に近いものを選び、「A〜C」で回答してください。

A：少食で満腹になりやすい  
B：しっかり食べる方  
C：日によって差がある`,
    buttons: [
      { label: 'A', data: 'stomach_Q1_A' },
      { label: 'B', data: 'stomach_Q1_B' },
      { label: 'C', data: 'stomach_Q1_C' },
    ],
  });

  return flex;
};
