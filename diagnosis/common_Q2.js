const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q2() {
  const flex = MessageBuilder({
    altText: '【質問2】冷えや暑さについて',
    header: '【Q2】環境温度の感じ方',
    header: '【Q2】環境温度の感じ方(寒/熱)',
    body: `Q2：気温や環境について、普段どのように感じますか？（A・B両方の場合、より辛く感じる方を選んでください。）\n\nA：寒がりで、冷えると不調を感じやすい（寒）\n\nB：暑がりで、ほてり・のぼせが出やすい（熱）\n\nC：寒さも暑さもあまり気にならない（平性）`,
    buttons: [
      { label: 'A', data: 'common_Q2_A' },
      { label: 'B', data: 'common_Q2_B' },
      { label: 'C', data: 'common_Q2_C' },
    ],
  });

  return flex;
};
