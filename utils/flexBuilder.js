// utils/flexBuilder.js

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

// 主訴選択のFlexメッセージを作成（修正版）
function buildCategorySelectionFlex() {
  return MessageBuilder({
    altText: '診断を開始します。どの不調が気になりますか？',
    header: '診断スタート',
    body: 'どの不調をととのえたいですか？1つ選んでください。',
    buttons: [
      { label: '胃腸の調子', data: 'stomach' },
      { label: '睡眠改善・集中力', data: 'sleep' },
      { label: '肩こり・腰痛・関節', data: 'pain' },
      { label: 'イライラや不安感', data: 'mental' },
      { label: '冷え・のぼせ・むくみ', data: 'cold' },
      { label: '頭髪や肌の健康', data: 'skin' },
      { label: '花粉症・鼻炎', data: 'pollen' },
      { label: '女性特有のお悩み', data: 'women' },
      { label: 'なんとなく不調・不定愁訴', data: 'unknown' },
    ],
  });
}

// 質問用のFlexメッセージをビルド（Q1〜Q5）
async function buildQuestionFlex(key) {
  try {
    const questionModule = require(`../diagnosis/${key}`);
    const flex = await questionModule();
    return flex;
  } catch (error) {
    console.error(`❌ 質問モジュールの読み込みエラー (${key})`, error);
    return {
      type: 'text',
      text: 'ごめんなさい、質問の取得に失敗しました。もう一度試してください。',
    };
  }
}

module.exports = {
  MessageBuilder,
  buildCategorySelectionFlex,
  buildQuestionFlex,
};
