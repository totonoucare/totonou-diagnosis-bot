const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function pain_Q4() {
  const flex = MessageBuilder({
    altText: '【質問4】痛みの質や出方',
    header: '【Q4】痛みの質や出方',
    body: `Q4：痛みの出方で、近いものは？\n\nA：張りが強い・動き出しの時が辛い（朝起きた瞬間など）\n\nB：重だるい・むくむ／天気や湿気で悪化しやすい\n\nC：刺すような痛み／夜間悪化／押すと強く痛い\n\nD：どれとも言えない`,
    buttons: [
      { label: 'A', data: 'pain_Q4_A' },
      { label: 'B', data: 'pain_Q4_B' },
      { label: 'C', data: 'pain_Q4_C' },
      { label: 'D', data: 'pain_Q4_D' },
    ],
  });

  return flex;
};
