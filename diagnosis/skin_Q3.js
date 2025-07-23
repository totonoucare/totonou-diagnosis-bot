const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function skin_Q3() {
  const flex = MessageBuilder({
    altText: '【質問3】髪や肌の状態',
    header: '【Q3】髪や肌、体力の変化',
    body: `Q3：次のうち、気になる状態を多く（または強く）含む選択肢はどれですか？\n\nA：目が疲れやすい／肌や髪が乾燥しがち／不安になりやすい\n\nB：階段や坂で息が切れる／声が小さい・張れない\n\nC：特に気になるものはない`,
    buttons: [
      { label: 'A', data: 'skin_Q3_A' },
      { label: 'B', data: 'skin_Q3_B' },
      { label: 'C', data: 'skin_Q3_C' },
    ],
  });

  return flex;
};
