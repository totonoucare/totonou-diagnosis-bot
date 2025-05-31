const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function pollen_Q2() {
  const flex = MessageBuilder({
    altText: '【質問2】鼻や体の状態',
    header: '【Q2】鼻の症状と冷え・熱の関係',
    body: `Q2：鼻や体の状態について、最近当てはまるのは？\nA：くしゃみが止まらない・冷えると悪化\nB：鼻水が黄色っぽい・鼻の奥が熱っぽい・鼻血\nC：とくに気になる冷えや熱はない`,
    buttons: [
      { label: 'A', data: 'pollen_Q2_A' },
      { label: 'B', data: 'pollen_Q2_B' },
      { label: 'C', data: 'pollen_Q2_C' },
    ],
  });

  return flex;
};
