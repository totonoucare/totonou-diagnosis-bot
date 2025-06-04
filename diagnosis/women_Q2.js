const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function women_Q2() {
  const flex = MessageBuilder({
    altText: '【質問2】冷え・のぼせ',
    header: '【Q2】冷えやのぼせの傾向',
    body: `Q2：冷えやのぼせについて、当てはまるのは？\n\nA：全身が冷える／下腹部が冷たい\nB：上半身や顔がほてる／寝汗・のぼせ・イライラ\nC：とくに感じない`,
    buttons: [
      { label: 'A', data: 'women_Q2_A' },
      { label: 'B', data: 'women_Q2_B' },
      { label: 'C', data: 'women_Q2_C' },
    ],
  });

  return flex;
};
