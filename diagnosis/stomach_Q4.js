const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function stomach_Q4() {
  const flex = MessageBuilder({
    altText: '【質問4】食後のお腹の感じに近いのは？',
    header: '【Q4】食後のお腹の感じ',
    body: `以下から最も近いものを選び、「A〜D」で回答してください。

A：ガスが溜まる・張る（＝気滞）
B：重だるい・もたれる（＝痰湿）
C：差し込む痛み・黒っぽい便（＝瘀血）
D：特に気にならない（＝流通良好）`,
    buttons: [
      { label: 'A', data: 'stomach_Q4_A' },
      { label: 'B', data: 'stomach_Q4_B' },
      { label: 'C', data: 'stomach_Q4_C' },
      { label: 'D', data: 'stomach_Q4_D' },
    ],
  });

  return flex;
};
