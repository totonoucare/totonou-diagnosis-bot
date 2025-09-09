const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function common_Q1() {
  const flex = MessageBuilder({
    altText: '【質問1】ここ数年間の体力傾向',
    header: '【Q1】ここ数年間の体力傾向',
    body: `Q1：以下のうち、ここ数年間の体力傾向で一番近いものを選んでください。\n\nA：予定が続くとぐったり、回復に時間がかかる\n\nB：体力に余裕があり、症状が強めに出やすい\n\nC：疲れはするが、休めば回復する`,
    buttons: [
      { label: 'A', data: 'common_Q1_A' },
      { label: 'B', data: 'common_Q1_B' },
      { label: 'C', data: 'common_Q1_C' },
    ],
  });

  return flex;
};
