// diagnosis/stomach_Q2.js
const { buildQuestionFlex } = require('../utils/flexBuilder');

module.exports = async (userId, client) => {
  const flex = buildQuestionFlex({
    title: 'Q2：お腹の不調が強くなるのは？',
    questionId: 'Q2',
    options: [
      { label: '冷たい飲食／冷房で悪化', value: 'A' },
      { label: '油っこいもの／胃が熱い感じ', value: 'B' },
      { label: '特にどちらもない', value: 'C' }
    ]
  });

  await client.pushMessage(userId, flex);
};
