const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function stomach_Q4() {
  const flex = MessageBuilder({
    altText: '【質問4】食後のお腹の感じに近いのは？',
    header: '【Q4】食後のお腹の感じに近いのは？',
    body: '以下から最も近い状態を1つ選んでください。',
    buttons: [
      { label: 'A：ガスが溜まる・張る', data: 'stomach_Q4_A' }, // 気滞
      { label: 'B：重だるい・もたれる', data: 'stomach_Q4_B' }, // 痰湿
      { label: 'C：差し込む痛み・黒っぽい便', data: 'stomach_Q4_C' }, // 瘀血
      { label: 'D：特に気にならない', data: 'stomach_Q4_D' }, // 正常
    ],
  });

  return flex;
};
