const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function stomach_Q3() {
  const flex = MessageBuilder({
    altText: '【質問3】お腹の働きについて',
    header: '【Q3】お腹の働きについて',
    body: `Q3：次のうち、気になる状態を多く（または強く）含む選択肢はどれですか？\n\nA：目が疲れやすい／肌や髪が乾燥しがち／不安になりやすい\n\nB：疲れやすい・息切れしやすい／声が小さい・張れない\n\nC：特に気になるものはない`,
    buttons: [
      { label: 'A', data: 'stomach_Q3_A' },
      { label: 'B', data: 'stomach_Q3_B' },
      { label: 'C', data: 'stomach_Q3_C' },
    ],
  });

  return flex;
};
