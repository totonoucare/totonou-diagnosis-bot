const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function skin_Q1() {
  const flex = MessageBuilder({
    altText: '【質問1】抜け毛や肌トラブルのタイミング',
    header: '【Q1】肌や髪の不調が起きやすい時期',
    body: `Q1：抜け毛や肌トラブルが起きやすいタイミングは？\nA：疲れているとき／季節の変わり目に弱い\nB：寝不足やストレスが強いと一気に悪化\nC：どちらでもない`,
    buttons: [
      { label: 'A', data: 'skin_Q1_A' },
      { label: 'B', data: 'skin_Q1_B' },
      { label: 'C', data: 'skin_Q1_C' },
    ],
  });

  return flex;
};
