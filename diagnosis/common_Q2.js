const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q2() {
  const flex = MessageBuilder({
    altText: '【質問2】冷えや暑さについて',
    header: '【Q2】環境温度の感じ方',
    header: '【Q2】環境温度の感じ方',
    body: `Q2：気温や環境について、普段どのように感じますか？\n\nA：寒がりで、冷えると体調を崩しやすい\n\nB：暑がりで、ほてり・のぼせが出やすい\n\nC：暑さ・寒さは同じくらいツラい、またはどちらもあまり気にならない`,
    buttons: [
      { label: 'A', data: 'common_Q2_A' },
      { label: 'B', data: 'common_Q2_B' },
      { label: 'C', data: 'common_Q2_C' },
    ],
  });

  return flex;
};
