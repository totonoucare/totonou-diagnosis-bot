const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function stomach_Q4() {
  const flex = MessageBuilder({
    altText: '【質問4】食後のお腹の感じ',
    header: '【Q4】食後のお腹の感じ',
    body: `Q4：食後のお腹の感じに近いのは？\n\nA：パンパンに張る・ガスが溜まる感じ\n\nB：ズーンと重くてだるい・胃がもたれる\n\nC：鈍く重い痛み・黒っぽい便・シクシク痛む\n\nD：特に気にならない`,
    buttons: [
      { label: 'A', data: 'stomach_Q4_A' },
      { label: 'B', data: 'stomach_Q4_B' },
      { label: 'C', data: 'stomach_Q4_C' },
      { label: 'D', data: 'stomach_Q4_D' },
    ],
  });

  return flex;
};
