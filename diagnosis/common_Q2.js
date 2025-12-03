const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q2() {
  const flex = MessageBuilder({
    altText: '【質問2】冷えや暑さについて',
    header: '【Q2】環境温度の感じ方について',
    body: `Q2：気温や環境について、普段どのように感じますか？\n\nA：冬の寒さやクーラーで冷えやすく、冷えると不調が出やすい\n\nB：暑さのほうが苦手で、上半身の熱感・ほてり・のぼせが出やすい\n\nC：寒さや暑さに対して、特別弱いと感じるほどの偏りはない\n\n（※「冷え」と「ほてり／のぼせ」の辛さが混在する場合は B をお選びください）`,
    buttons: [
      { label: 'A', data: 'common_Q2_A' },
      { label: 'B', data: 'common_Q2_B' },
      { label: 'C', data: 'common_Q2_C' },
    ],
  });

  return flex;
};
