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
            type: 'text',
            text: btn.label,
            size: 'sm',
            weight: 'bold',
            align: 'center',
            wrap: true,
            gravity: 'center',
            color: '#ffffff',
            backgroundColor: '#87C7F5',
            paddingAll: '12px',
            action: {
              type: 'postback',
              label: btn.label,
              data: btn.data,
              displayText: btn.label
            }
          }))
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
      { label: '胃腸の調子を整えたい', data: 'stomach' },
      { label: '睡眠改善・\n集中力を取り戻したい', data: 'sleep' },
      { label: '肩こり・腰痛・\n関節の症状を整えたい', data: 'pain' },
      { label: 'イライラや不安感から\n解放されたい', data: 'mental' },
      { label: '冷え・のぼせ・\nむくみを整えたい', data: 'cold' },
      { label: '頭皮や肌の健康を\n整えたい', data: 'skin' },
      { label: '花粉症・鼻炎を\nマシにしたい', data: 'nose' },
      { label: '女性特有の悩みを\n整えたい', data: 'women' },
      { label: '“なんとなく不調”を\n整えたい', data: 'vague' },
    ],
  });
}

module.exports = {
  MessageBuilder,
  buildCategorySelectionFlex,
};
