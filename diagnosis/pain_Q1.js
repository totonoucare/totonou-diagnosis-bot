const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function pain_Q1() {
  const flex = MessageBuilder({
    altText: '【質問1】ここ数年間の体力傾向',
    header: '【Q1】ここ数年間の体力傾向（共通質問）',
    body: `Q1：以下のうち、一番近いものを選んでください。\n\nA：予定が続くとぐったりする。寝ても疲れが抜けにくい。\nB：予定が多くても比較的元気。少しの休息ですぐ動ける。\nC：C：予定が多いと疲れはするけど、寝れば戻る`,
    buttons: [
      { label: 'A', data: 'common_Q1_A' },
      { label: 'B', data: 'common_Q1_B' },
      { label: 'C', data: 'common_Q1_C' },
    ],
  });

  return flex;
};
