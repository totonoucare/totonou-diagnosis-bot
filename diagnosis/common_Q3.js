const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q3() {
  const flex = MessageBuilder({
    altText: '【質問3】体力やお身体の状態について',
    header: '【Q3】体力やお身体の状態について',
    body: `Q3：最近のお身体の状態で、どちらの傾向が多いと感じますか？
（一部あてはまる場合でも、より多い方を選んでください）\n\nA：夢が多い／めまい・立ちくらみ／肌・髪が乾燥\nB：疲れやすい／息切れしやすい／声に力がない\nC：どちらもあまり感じない`,
    buttons: [
      { label: 'A', data: 'common_Q3_A' },
      { label: 'B', data: 'common_Q3_B' },
      { label: 'C', data: 'common_Q3_C' },
    ],
  });

  return flex;
};
