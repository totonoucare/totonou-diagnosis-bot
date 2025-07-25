const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function women_Q2() {
  const flex = MessageBuilder({
    altText: '【質問2】冷え・のぼせ',
    header: '【Q2】冷えやのぼせの傾向',
    body: `Q2：気温や環境について、普段どのように感じますか？\n\nA：寒がりで、少し冷えるだけで厚着したくなる\n\nB：暑がり(またはほてり・のぼせ)で、すぐに上着を脱ぎたくなる\n\nC：暑さ・寒さは同じくらいツラい、またはどちらもあまり気にならない`,
    buttons: [
      { label: 'A', data: 'women_Q2_A' },
      { label: 'B', data: 'women_Q2_B' },
      { label: 'C', data: 'women_Q2_C' },
    ],
  });

  return flex;
};
