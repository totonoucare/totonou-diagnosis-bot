const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function pain_Q2() {
  const flex = MessageBuilder({
    altText: '【質問2】痛みと冷え・熱の関係',
    header: '【Q2】痛みに関する特徴',
    body: `Q2：痛みに関して、当てはまるものは？\nA：冷えると悪化／温めると楽\nB：熱っぽい・腫れている・夜に悪化\nC：特に冷えや熱での変化はない`,
    buttons: [
      { label: 'A', data: 'pain_Q2_A' },
      { label: 'B', data: 'pain_Q2_B' },
      { label: 'C', data: 'pain_Q2_C' },
    ],
  });

  return flex;
};
