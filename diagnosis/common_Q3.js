const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q3() {
  const flex = MessageBuilder({
    altText: '【質問3】体力やお身体の状態について',
    header: '【Q3】エネルギーと潤いのバランスについて',
    body: `Q3：次のうち、より当てはまる状態をお選びください。\n（※AとBの両方がある場合は、どちらがより気になるかでお選びください）\n\nA：肌や髪が乾燥しやすい／目のかすみ／不安を感じやすい\n\nB：食後にだるい／声が弱くなる／力が入りにくい\n\nC：特に気になるものはない`,
    buttons: [
      { label: 'A', data: 'common_Q3_A' },
      { label: 'B', data: 'common_Q3_B' },
      { label: 'C', data: 'common_Q3_C' },
    ],
  });

  return flex;
};
