const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function pain_Q1() {
  const flex = MessageBuilder({
    altText: '【質問1】痛みが出るタイミング',
    header: '【Q1】痛みが出るタイミングやきっかけ',
    body: `Q1：痛みが出るタイミングやきっかけで近いのは？\n\nA：疲れるとズーンと重だるくなる\nB：動かすと痛む／押すと痛い\nC：どちらとも言えない`,
    buttons: [
      { label: 'A', data: 'pain_Q1_A' },
      { label: 'B', data: 'pain_Q1_B' },
      { label: 'C', data: 'pain_Q1_C' },
    ],
  });

  return flex;
};
