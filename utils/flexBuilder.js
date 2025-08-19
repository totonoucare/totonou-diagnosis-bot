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
        backgroundColor: '#758A6D',
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
            color: '#0d0d0d',
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
            color: '#758A6D',
          })),
        ],
      },
    },
  };
}

function injectContext(template, context = {}) {
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => context[key] ?? `{{${key}}}`);
}

function buildCategorySelectionFlex() {
  return MessageBuilder({
    altText: '分析を開始します。どの不調が気になりますか？',
    header: '🚀 分析スタート！',
    body: 'どんなお悩みをととのえたいですか？1つ選んでください。',
    buttons: [
      { label: '胃腸の調子', data: 'stomach', displayText: '胃腸の調子' },
      { label: '睡眠・集中力', data: 'sleep', displayText: '睡眠・集中力' },
      { label: '肩こり・腰痛・関節痛', data: 'pain', displayText: '肩こり・腰痛・関節痛' },
      { label: 'イライラや不安感', data: 'mental', displayText: 'イライラや不安感' },
      { label: '体温バランス・むくみ', data: 'cold', displayText: '体温バランス・むくみ' },
      { label: '頭髪や肌の健康', data: 'skin', displayText: '頭髪や肌の健康' },
      { label: '花粉症・鼻炎', data: 'pollen', displayText: '花粉症・鼻炎' },
      { label: '女性特有のお悩み', data: 'women', displayText: '女性特有のお悩み' },
      { label: 'なんとなく不調・不定愁訴', data: 'unknown', displayText: 'なんとなく不調・不定愁訴' },
    ],
  });
}

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
      contents: q.items.map((choice) => ({
        type: 'button',
        action: {
          type: 'postback',
          label: choice,
          data: `${q.key}:${choice}`,
          displayText: `${q.title} → ${choice}`,
        },
        height: 'sm',
        style: 'primary',
        color: '#758A6D',
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
        backgroundColor: '#758A6D',
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
            color: '#0d0d0d',
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

function buildDiagnosisConfirmFlex() {
  return {
    type: "flex",
    altText: "体質分析を始めますか？",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "体質分析を始めますか？",
            weight: "bold",
            size: "md",
            color: "#ffffff",
          },
        ],
        backgroundColor: "#758A6D",
        paddingAll: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#F8F9F7",
        paddingAll: "16px",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "初めての方はそのまま分析をスタートしてください🌱\n2回目以降の方は、前回の分析結果の記録が上書き保存されるのでご注意ください。",
            wrap: true,
            size: "md",
            color: "#0d0d0d",
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "分析スタート！",
              text: "分析開始",
            },
            style: "primary",
            color: "#758A6D",
          },
        ],
      },
    },
  };
}

function buildFollowupConfirmFlex() {
  return {
    type: "flex",
    altText: "定期チェックナビを始めますか？",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "定期チェックナビを始めますか？",
            weight: "bold",
            size: "md",
            color: "#ffffff",
          },
        ],
        backgroundColor: "#758A6D",
        paddingAll: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#F8F9F7",
        paddingAll: "16px",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "週1回の体調変化とケア習慣状況の記録＆AIアドバイスの機能です！\nとととのうケアガイドのセルフケアは実施できましたか？\nまだ見ていない方は、まずそちらを確認してから定期チェックナビを受けてくださいね！\n🌟定期チェックナビご利用後はショップカードのポイントが貯まります！",
            wrap: true,
            size: "md",
            color: "#0d0d0d",
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "定期チェックナビ開始",
              text: "定期チェックナビ開始",
            },
            style: "primary",
            color: "#758A6D",
          },
        ],
      },
    },
  };
}

function buildFollowupQuestionFlex(questionObj, context = {}) {
  const { id, header, body, options, isMulti } = questionObj;

  const injectedHeader = injectContext(header, context);
  const injectedBody = injectContext(body, context);

  if (isMulti) {
    const questionContents = options.flatMap((q) => [
      {
        type: 'text',
        text: `🔸 ${injectContext(q.label, context)}`,
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
        contents: q.items.map((choice) => ({
          type: 'button',
          action: {
            type: 'postback',
            label: choice,
            data: `${q.id}:${choice}`,
            displayText: `${injectContext(q.label, context)} → ${choice}`,
          },
          height: 'sm',
          style: 'primary',
          color: '#758A6D',
          flex: 1,
        })),
      },
    ]);

    return {
      type: 'flex',
      altText: injectedHeader,
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [{ type: 'text', text: injectedHeader, weight: 'bold', size: 'md', color: '#ffffff' }],
          backgroundColor: '#758A6D',
          paddingAll: '12px',
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            { type: 'text', text: injectedBody, wrap: true, size: 'md', color: '#333333' },
            { type: 'separator', margin: 'md' },
            ...questionContents,
          ],
        },
      },
    };
  } else {
    const buttons = options.map((opt) => ({
      label: opt,
      data: `${id}:${opt}`,
      displayText: `${injectedHeader} → ${opt}`,
    }));
    return MessageBuilder({
      altText: injectedHeader,
      header: injectedHeader,
      body: injectedBody,
      buttons,
    });
  }
}

function buildResultFlex(result, imageUrl) {
  return {
    type: 'flex',
    altText: '分析結果：あなたの体質タイプ',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `📝 【 ${result.type} 】`,
            weight: 'bold',
            size: 'lg', // ← サイズUPでさらに強調
            color: '#ffffff',
          },
        ],
        backgroundColor: '#758A6D',
        paddingAll: '12px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        backgroundColor: '#F8F9F7', // ✅ 柔らか背景追加！
        paddingAll: '12px',         // ✅ 本文エリア全体に余白
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            paddingAll: '10px',
            contents: [
              {
                type: 'image',
                url: imageUrl,
                size: 'full',
                aspectMode: 'fit',
                aspectRatio: '1:1'
              }
            ]
          },
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: 'text',
            text: '【 🧭 体質解説 】',
            weight: 'bold',
            size: 'sm',
            color: '#0d0d0d',
          },
          {
            type: 'text',
            text: result.traits,
            wrap: true,
            size: 'md',
            color: '#333333',
          },
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: 'text',
            text: '【 🌀 巡りの傾向 】',
            weight: 'bold',
            size: 'sm',
            color: '#0d0d0d',
          },
          {
            type: 'text',
            text: result.flowIssue,
            wrap: true,
            size: 'md',
            color: '#333333',
          },
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: 'text',
            text: '【 🫁 経絡(けいらく)の負担傾向 】',
            weight: 'bold',
            size: 'sm',
            color: '#0d0d0d',
          },
          {
            type: 'text',
            text: result.organBurden,
            wrap: true,
            size: 'md',
            color: '#333333',
          },
        ],
      },
    },
  };
}

function buildAdviceCarouselFlex(cards, altText = 'あなた専用ととのうケアガイド') {
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
      backgroundColor: '#758A6D',
      paddingAll: '12px',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F8F9F7', // ← 柔らかいグレー
      paddingAll: '16px',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: card.body,
          wrap: true,
          color: '#0d0d0d',
          size: 'md',
        },
        {
          type: 'separator',
          margin: 'md',
        },
      ],
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

function buildCarouselFlex(cards, altText = '分析結果とセルフケア提案') {
  return buildAdviceCarouselFlex(cards, altText);
}

function buildReminderFlex() {
  return {
    type: 'flex',
    altText: '📅 定期チェックナビのご案内',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📅 定期チェックナビ',
            weight: 'bold',
            size: 'md',
            color: '#ffffff',
          },
        ],
        backgroundColor: '#758A6D',
        paddingAll: '12px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: '前回から、セルフケアの調子はいかがですか❓\n『定期チェックナビ』で、ととのい具合の確認とケアの見直し提案をいつでもサポートしますよ🌿',
            wrap: true,
            color: '#333333',
            size: 'md',
          },
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '定期チェックナビ',
              text: '定期チェックナビ',
            },
            style: 'primary',
            color: '#758A6D',
          },
        ],
      },
    },
  };
}

function buildChatConsultOptionsFlex() {
  return {
    type: "flex",
    altText: "チャット相談メニュー",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "チャット相談メニュー",
            weight: "bold",
            size: "md",
            color: "#ffffff",
          },
        ],
        backgroundColor: "#758A6D", // 落ち着いたアースグリーン27AE60
        paddingAll: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#F8F9F7", // 柔らかいグレー
        paddingAll: "16px",
        spacing: "md",
        contents: [
          {
            type: "button",
            action: {
              type: "message",
              label: "🧠 ととのうGPTでAI相談",
              text: "ととのうGPTでAI相談",
            },
            style: "primary",
            color: "#758A6D", // ナチュラルグリーン
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "👤 LINEでプロに相談",
              text: "LINEでプロに相談",
            },
            style: "secondary",
            color: "#B3C2B1", // 淡いグリーングレー
          },
        ],
      },
    },
  };
}


function buildTrialStartFlex() {
  return {
    type: 'flex',
    altText: '🎁 無料トライアル開始ボタン',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🎁 無料トライアルを始める',
            weight: 'bold',
            size: 'md',
            color: '#ffffff',
          },
        ],
        backgroundColor: '#758A6D',
        paddingAll: '12px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: '紹介が完了した方は、下のボタンを押して無料体験を始めましょう！',
            wrap: true,
            color: '#333333',
            size: 'md',
          },
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '紹介完了',
              data: 'trial_intro_done',
              displayText: '紹介完了',
            },
            style: 'primary',
            color: '#758A6D',
          },
        ],
      },
    },
  };
}

module.exports = {
  MessageBuilder,
  buildCategorySelectionFlex,
  buildQuestionFlex,
  buildDiagnosisConfirmFlex,
  buildFollowupConfirmFlex,
  buildMultiQuestionFlex,
  buildAdviceCarouselFlex,
  buildCarouselFlex,
  buildFollowupQuestionFlex,
  buildChatConsultOptionsFlex,
  buildReminderFlex,
  buildTrialStartFlex, 
  buildResultFlex, 
};
