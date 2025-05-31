// diagnosis/stomach_Q3.js
const { buildQuestionFlex } = require('../utils/flexBuilder');

module.exports = async (userId, client) => {
  const flex = buildQuestionFlex({
    title: 'Q3：お腹の働きについて当てはまるのは？',
    questionId: 'Q3',
    options: [
      { label: '口が渇く／唇が荒れる／便が硬い', value: 'A' },
      { label: '食欲なし／軟便・下痢ぎみ', value: 'B' },
      { label: 'どちらもない', value: 'C' }
    ]
  });

  await client.pushMessage(userId, flex);
};
