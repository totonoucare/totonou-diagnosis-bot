function MessageBuilder({ altText, header, body, buttons }) {
  return {
    type: 'flex',
    altText,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: header,
            weight: 'bold',
            size: 'md',
            color: '#ffffff',
          },
        ],
        backgroundColor: '#5DB2E8',
        paddingAll: '12px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: body,
            wrap: true,
            color: '#333333',
            size: 'sm',
          },
          {
            type: 'separator',
            margin: 'md',
          },
          ...buttons.map((btn) => ({
            type: 'button',
            action: {
              type: 'postback',
              label: btn.label,
              data: btn.data,
              displayText: btn.label,
            },
            style: 'primary',
            height: 'sm',
            margin: 'sm',
            color: '#87C7F5',
          })),
        ],
      },
    },
  };
}

// 主訴選択のFlexメッセージを作成
function buildCategorySelectionFlex() {
  return MessageBuilder({
    altText: '診断を開始します。どの不調が気になりますか？',
    header: '診断スタート',
    body: 'どの不調が気になりますか？1つ選んでください。',
    buttons: [
      { label: '胃腸の調子', data: '胃腸の調子を整えたい' },
      { label: '睡眠・集中力', data: '睡眠改善・集中力を取り戻したい' },
      { label: '肩こり腰痛など', data: '肩こり・腰痛・関節の症状を整えたい' },
      { label: '気分の波', data: 'イライラや不安感から解放されたい' },
      { label: '冷え・のぼせ', data: '冷え・のぼせ・むくみを整えたい' },
      { label: '肌や頭皮', data: '頭皮や肌の健康を整えたい' },
      { label: '花粉症・鼻炎', data: '花粉症・鼻炎をマシにしたい' },
      { label: '女性の悩み', data: '女性特有の悩みを整えたい' },
      { label: 'なんとなく不調', data: '“なんとなく不調”を整えたい' },
    ],
  });
}

module.exports = {
  MessageBuilder,
  buildCategorySelectionFlex,
};
