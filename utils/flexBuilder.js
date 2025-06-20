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
        backgroundColor: '#788972',
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
            size: 'md',
          },
          {
            type: 'separator',
            margin: 'md',
          },
          ...(buttons || []).map((btn) => ({
            type: 'button',
            action: {
              type: 'postback',
              label: btn.label,
              data: btn.data,
              displayText: btn.displayText ?? btn.label,
            },
            style: 'primary',
            height: 'sm',
            margin: 'sm',
            color: '#828E7B',
          })),
        ],
      },
    },
  };
}

// カテゴリー選択用のバブル
function buildCategorySelectionFlex() {
  return MessageBuilder({
    altText: '診断を開始します。どの不調が気になりますか？',
    header: '診断スタート',
    body: 'どの不調をととのえたいですか？1つ選んでください。',
    buttons: [
      { label: '胃腸の調子', data: 'stomach', displayText: '胃腸の調子' },
      { label: '睡眠改善・集中力', data: 'sleep', displayText: '睡眠改善・集中力' },
      { label: '肩こり・腰痛・関節痛', data: 'pain', displayText: '肩こり・腰痛・関節' },
      { label: 'イライラや不安感', data: 'mental', displayText: 'イライラや不安感' },
      { label: '体温バランス・むくみ', data: 'cold', displayText: '体温バランス・むくみ' },
      { label: '頭髪や肌の健康', data: 'skin', displayText: '頭髪や肌の健康' },
      { label: '花粉症・鼻炎', data: 'pollen', displayText: '花粉症・鼻炎' },
      { label: '女性特有のお悩み', data: 'women', displayText: '女性特有のお悩み' },
      { label: 'なんとなく不調・不定愁訴', data: 'unknown', displayText: 'なんとなく不調・不定愁訴' },
    ],
  });
}

// 通常の質問カードをビルド（Flex）
async function buildQuestionFlex(questionFunction) {
  try {
    const flex = await questionFunction();
    return flex;
  } catch (error) {
    console.error('❌ 質問関数の実行エラー', error);
    return {
      type: 'text',
      text: 'ごめんなさい、質問の取得に失敗しました。もう一度試してください。',
    };
  }
}

// 複数小問対応の質問カード
function buildMultiQuestionFlex({ altText, header, body, questions }) {
  const questionContents = questions.flatMap((q) => [
    {
      type: 'text',
      text: `🔸 ${q.title}`,
      weight: 'bold',
      size: 'sm',
      margin: 'md',
      color: '#444444',
    },
    {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      margin: 'sm',
      contents: ['A', 'B', 'C', 'D'].map((choice) => ({
        type: 'button',
        action: {
          type: 'postback',
          label: choice,
          data: `${q.key}:${choice}`,
          displayText: `${q.title} → ${choice}`,
        },
        height: 'sm',
        style: 'primary',
        color: '#828E7B',
        flex: 1,
      })),
    },
  ]);

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
        backgroundColor: '#788972',
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
            size: 'md',
            color: '#333333',
          },
          {
            type: 'separator',
            margin: 'md',
          },
          ...questionContents,
        ],
      },
    },
  };
}

// アドバイスカード（カルーセル）作成
function buildAdviceCarouselFlex(cards, altText = 'AIが提案！ととのう計画') {
  const bubbles = cards.map((card) => ({
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: card.header,
          weight: 'bold',
          size: 'md',
          color: '#ffffff',
        },
      ],
      backgroundColor: '#788972',
      paddingAll: '12px',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: card.body,
          wrap: true,
          color: '#333333',
          size: 'md',
        },
      ],
      spacing: 'md',
    },
  }));

  return {
    type: 'flex',
    altText,
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
}

// 通常のカルーセル（別名）
function buildCarouselFlex(cards, altText = '診断結果とセルフケア提案') {
  return buildAdviceCarouselFlex(cards, altText); // 実装は同じものを流用
}

module.exports = {
  MessageBuilder,
  buildCategorySelectionFlex,
  buildQuestionFlex,
  buildMultiQuestionFlex,
  buildAdviceCarouselFlex,
  buildCarouselFlex, // ← 忘れずに追加！
};
