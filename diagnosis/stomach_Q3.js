const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function stomach_Q3() {
  const flex = MessageBuilder({
    altText: '【質問3】お腹の働きについて当てはまるのは？',
    header: '【Q3】お腹の働きについて当てはまるのは？',
    body: '次のうち、あなたに当てはまるものを選んでください。',
    buttons: [
      { label: 'A：口が渇く／唇が荒れる／便が硬い', data: 'stomach_Q3_A' },
      { label: 'B：食欲なし／軟便・下痢ぎみ', data: 'stomach_Q3_B' },
      { label: 'C：どちらもない', data: 'stomach_Q3_C' },
    ],
  });

  return flex;
};
