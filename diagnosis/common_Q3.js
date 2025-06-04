const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q3() {
  const flex = MessageBuilder({
    altText: '【質問3】体力やエネルギー感について',
    header: '【Q3】体力やエネルギー感について',
    body: `Q3：体力やエネルギー感について、最も近いのはどれですか？\n\nA：夢が多い／めまい・立ちくらみ／肌・髪が乾燥\nB：疲れやすい／息切れしやすい／声に力がない\nC：どちらもあまり感じない`,
    buttons: [
      { label: 'A', data: 'common_Q3_A' },
      { label: 'B', data: 'common_Q3_B' },
      { label: 'C', data: 'common_Q3_C' },
    ],
  });

  return flex;
};
