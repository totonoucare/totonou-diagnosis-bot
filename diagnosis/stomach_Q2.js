const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function stomach_Q2() {
  const flex = MessageBuilder({
    altText: '【質問2】お腹の不調が強くなるのは？',
    header: '【Q2】お腹の不調が強くなるのは？',
    body: '次のうち、あなたに当てはまるものを選んでください。',
    buttons: [
      { label: 'A：冷たい飲食／冷房で悪化', data: 'stomach_Q2_A' },
      { label: 'B：油っこいもの／胃が熱い感じ', data: 'stomach_Q2_B' },
      { label: 'C：特にどちらもない', data: 'stomach_Q2_C' },
    ],
  });

  return flex;
};
