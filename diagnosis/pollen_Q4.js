const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function pollen_Q4() {
  const flex = MessageBuilder({
    altText: '【質問4】鼻や頭の不調',
    header: '【Q4】鼻まわりのつらさについて',
    body: `Q4：次のうち、当てはまる状態をより多く（または強く）含む選択肢はどれですか？\n\nA：ずっと詰まっていてイライラ\nB：どろっとした鼻水／頭が重い／だるい\nC：頭が締めつけられる／クマやくすみ／鼻血\nD：とくに当てはまらない`,
    buttons: [
      { label: 'A', data: 'pollen_Q4_A' },
      { label: 'B', data: 'pollen_Q4_B' },
      { label: 'C', data: 'pollen_Q4_C' },
      { label: 'D', data: 'pollen_Q4_D' },
    ],
  });

  return flex;
};
