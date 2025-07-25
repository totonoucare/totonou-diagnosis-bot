const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function stomach_Q2() {
  const flex = MessageBuilder({
    altText: '【質問2】お腹の不調について',
    header: '【Q2】お腹の不調について',
    body: `Q2：お腹の不調が強くなるのはどちらのとき？\n\nA：冷たい飲み物・冷房などで悪化する\n\nB：脂っこい・辛いもののあと／食後に胃が熱い感じ\n\nC：どちらのときもある、またはどちらでもない`,
    buttons: [
      { label: 'A', data: 'stomach_Q2_A' },
      { label: 'B', data: 'stomach_Q2_B' },
      { label: 'C', data: 'stomach_Q2_C' },
    ],
  });

  return flex;
};
