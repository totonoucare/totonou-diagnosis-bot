// diagnosis/stomach_Q5.js
const { buildQuestionFlex } = require('../utils/flexBuilder');

module.exports = async (userId, client) => {
  const flex = buildQuestionFlex({
    title: 'Q5：どの動作で最も違和感がありますか？',
    questionId: 'Q5',
    options: [
      { label: '首を左右に回す（肺・大腸）', value: 'A' },
      { label: '腕をバンザイする（心・小腸）', value: 'B' },
      { label: '前屈する（腎・膀胱）', value: 'C' },
      { label: '腰をねじる（肝・胆）', value: 'D' },
      { label: '上体をそらす（脾・胃）', value: 'E' }
    ]
  });

  await client.pushMessage(userId, flex);
};
