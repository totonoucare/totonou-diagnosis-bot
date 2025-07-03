const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q3() {
  const flex = MessageBuilder({
    altText: '【質問3】体力やお身体の状態について',
    header: '【Q3】体力やお身体の状態について',
    body: `Q3：次のうち、気になる状態を多く（または強く）含む選択肢はどれですか？\n\nA：顔色が悪い／髪や肌の乾燥／不安感がある\nB：軽い運動(階段・散歩)で疲れやすい／話し声が力ない\nC：どれも気になるほどではない`,
    buttons: [
      { label: 'A', data: 'common_Q3_A' },
      { label: 'B', data: 'common_Q3_B' },
      { label: 'C', data: 'common_Q3_C' },
    ],
  });

  return flex;
};
