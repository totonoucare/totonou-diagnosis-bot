const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q2() {
  const flex = MessageBuilder({
    altText: '【質問2】冷えやほてりについて',
    header: '【Q2】冷えやほてりについて',
    body: `Q2：最近、冷えやほてりについて感じることはありますか？\nA：全身が冷えやすい／寒がり／冷えると症状が悪化\nB：顔がほてる／寝汗・イライラ／夜に頭が冴える\nC：とくに冷えや熱は気にならない`,
    buttons: [
      { label: 'A', data: 'common_Q2_A' },
      { label: 'B', data: 'common_Q2_B' },
      { label: 'C', data: 'common_Q2_C' },
    ],
  });

  return flex;
};
