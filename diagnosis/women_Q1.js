const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function women_Q1() {
  const flex = MessageBuilder({
    altText: '【質問1】生理前後の不調について',
    header: '【Q1】生理のタイミングと不調',
    body: `Q1：生理前後で、不調が出やすいのは？\n\nA：月経前にイライラ・張り・むくみ\nB：月経後にだるさ・ふらつき・抜け毛\nC：どちらも特にない`,
    buttons: [
      { label: 'A', data: 'women_Q1_A' },
      { label: 'B', data: 'women_Q1_B' },
      { label: 'C', data: 'women_Q1_C' },
    ],
  });

  return flex;
};
