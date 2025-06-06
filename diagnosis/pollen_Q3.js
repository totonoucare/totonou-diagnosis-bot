const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function pollen_Q3() {
  const flex = MessageBuilder({
    altText: '【質問3】体力やエネルギー感',
    header: '【Q3】体力の傾向',
    body: `Q3：最近のお身体の調子で最もよく当てはまる傾向は？\n\nA：夢が多い／めまい・立ちくらみ／肌・髪が乾燥\nB：疲れやすい／息切れしやすい／声に力がない\nC：どちらもあまり感じない`,
    buttons: [
      { label: 'A', data: 'pollen_Q3_A' },
      { label: 'B', data: 'pollen_Q3_B' },
      { label: 'C', data: 'pollen_Q3_C' },
    ],
  });

  return flex;
};
