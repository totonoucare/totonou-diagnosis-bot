const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q3() {
  const flex = MessageBuilder({
    altText: '【質問3】体力やお身体の状態について',
    header: '【Q3】体力やお身体の状態について',
    body: `Q3：次のうち、気になる状態を多く（または強く）含む選択肢はどれですか？\n\nA：目が疲れやすい／肌や髪が乾燥しがち／不安になりやすい\n\nB：階段や坂で息が切れる／声が小さい・張れない\n\nC：特に気になるものはない`,
    buttons: [
      { label: 'A', data: 'common_Q3_A' },
      { label: 'B', data: 'common_Q3_B' },
      { label: 'C', data: 'common_Q3_C' },
    ],
  });

  return flex;
};
