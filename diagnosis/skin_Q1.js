const { MessageBuilder } = require('../utils/flexBuilder');

module.exports = async function skin_Q1() {
  const flex = MessageBuilder({
    altText: '【質問1】抜け毛や肌トラブルのタイミング',
    header: '【Q1】肌や髪の不調が起きやすい時期',
    body: `Q1：抜け毛や肌トラブルの出かたとして、より当てはまるのは？\n\nA：疲れが続くとじわじわ出る\nB：急に強く出る／ピリピリ・赤みが強い\nC：特に思い当たらない`,
    buttons: [
      { label: 'A', data: 'skin_Q1_A' },
      { label: 'B', data: 'skin_Q1_B' },
      { label: 'C', data: 'skin_Q1_C' },
    ],
  });

  return flex;
};
