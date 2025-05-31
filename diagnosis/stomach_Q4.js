// diagnosis/stomach_Q4.js
const { buildQuestionFlex } = require('../utils/flexBuilder');

module.exports = async (userId, client) => {
  const flex = buildQuestionFlex({
    title: 'Q4：食後のお腹の感じに近いのは？',
    questionId: 'Q4',
    options: [
      { label: 'パンパンに張る・ガスが溜まる', value: 'A' },
      { label: 'ズーンと重だるい・もたれる', value: 'B' },
      { label: '特に気にならない', value: 'C' }
    ]
  });

  await client.pushMessage(userId, flex);
};
