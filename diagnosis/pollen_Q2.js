const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function pollen_Q2() {
  const flex = MessageBuilder({
    altText: '【質問2】鼻や体の状態',
    header: '【Q2】鼻の症状と冷え・熱の関係',
    body: `Q2：次のうち、当てはまる状態をより多く（または強く）含む選択肢はどれですか？\n\nA：くしゃみが止まらない・冷えると悪化\nB：鼻水が黄色っぽい・鼻の奥が熱っぽい・鼻血\nC：とくに気になる冷えや熱はない`,
    buttons: [
      { label: 'A', data: 'pollen_Q2_A' },
      { label: 'B', data: 'pollen_Q2_B' },
      { label: 'C', data: 'pollen_Q2_C' },
    ],
  });

  return flex;
};
