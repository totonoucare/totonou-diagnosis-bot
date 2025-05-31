const { buildQuestionFlex } = require('../utils/flexBuilder');

module.exports = async (userId, client) => {
  const flex = buildQuestionFlex({
    title: 'Q1：風邪をひいた時、あなたに多いパターンはどれですか？',
    body: `A：長引きやすい・微熱くらいでグズグズ\nB：高熱が出る・喉や鼻の炎症が強い\nC：その時々で違う／どちらでもない`,
    questionId: 'Q1',
    options: [
      { label: 'A', data: 'common_Q1_A' },
      { label: 'B', data: 'common_Q1_B' },
      { label: 'C', data: 'common_Q1_C' }
    ]
  });

  await client.pushMessage(userId, flex);
};
