const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function stomach_Q2() {
  const flex = MessageBuilder({
    altText: '【質問2】お腹の不調について',
    header: '【Q2】お腹の不調について',
    body: `Q2：お腹の不調が強くなるのは？\nA：冷たい飲食のあと／冷房・冷気\nB：油っこい・辛いもの／食後に胃が熱い感じ\nC：どちらも当てはまらない`,
    buttons: [
      { label: 'A', data: 'stomach_Q2_A' },
      { label: 'B', data: 'stomach_Q2_B' },
      { label: 'C', data: 'stomach_Q2_C' },
    ],
  });

  return flex;
};
