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
        backgroundColor: '#7B9E76',
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
            color: '#7B9E76',
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
    altText: 'ととのえタイプ分析を開始します。どの不調が気になりますか？',
    header: '🚀 ととのえタイプ分析スタート！',
    body: 'どんなお悩みをととのえたいですか？1つ選んでください。',
    buttons: [
      { label: '胃腸の調子', data: 'stomach', displayText: '胃腸の調子' },
      { label: '睡眠・集中力', data: 'sleep', displayText: '睡眠・集中力' },
      { label: '肩こり・腰痛・関節痛', data: 'pain', displayText: '肩こり・腰痛・関節痛' },
      { label: '不安感やイライラ', data: 'mental', displayText: 'イライラや不安感' },
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
        color: '#7B9E76',
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
        backgroundColor: '#7B9E76',
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
    altText: "ととのえタイプ分析を始めますか？",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "ととのえタイプ分析を始めますか？",
            weight: "bold",
            size: "md",
            color: "#ffffff",
          },
        ],
        backgroundColor: "#7B9E76",
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
            text: "ととのえタイプ分析が初めての方は、そのまま分析をスタートしてください🌱",
            wrap: true,
            size: "md",
            color: "#0d0d0d",
          },
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: "text",
            text: "再分析の場合は、前回の分析結果の記録が上書き保存されるのでご注意ください。",
            wrap: true,
            size: "xs",
            color: "#888888",
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "ととのえタイプ分析開始！",
              text: "ととのえタイプ分析開始",
            },
            style: "primary",
            color: "#7B9E76",
          },
        ],
      },
    },
  };
}

function buildFollowupConfirmFlex() {
  return {
    type: "flex",
    altText: "ととのい度チェックを始めますか？",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "ととのい度チェックを始めますか？",
            weight: "bold",
            size: "md",
            color: "#ffffff",
          },
        ],
        backgroundColor: "#7B9E76",
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
            text: "こんにちは！\n今回もチェックへの取り組み素晴らしいです✨\n一歩ずつ一緒に改善していきましょう！",
            wrap: true,
            size: "md",
            color: "#0d0d0d",
          },
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: "text",
            text: "ご提案したケア内容を覚えていない場合は、まず『ととのうケアガイド』ボタンで確認してからチェックを受けてくださいね！",
            wrap: true,
            size: "xs",
            color: "#888888",
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "ととのい度チェック開始",
              text: "ととのい度チェック開始",
            },
            style: "primary",
            color: "#7B9E76",
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
          color: '#7B9E76',
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
          backgroundColor: '#7B9E76',
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
    altText: `分析結果：${result.type}／${result.symptomLabel}`,
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
            size: 'lg',
            color: '#ffffff',
          },
        ],
        backgroundColor: '#7B9E76',
        paddingAll: '12px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        backgroundColor: '#F8F9F7',
        paddingAll: '16px',
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
                aspectRatio: '1:1',
              },
            ],
          },

          { type: 'separator', margin: 'md' },

          // 🧭 概要セクション
          {
            type: 'text',
            text: '【 🧭 あなたのからだの今の状態 】',
            weight: 'bold',
            size: 'sm',
            color: '#0d0d0d',
          },
          {
            type: 'text',
            text: result.overview,
            wrap: true,
            size: 'md',
            color: '#333333',
          },

          { type: 'separator', margin: 'md' },

          // ① 体質
          {
            type: 'text',
            text: '【 ① 体質（根本）の特徴 】',
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

          { type: 'separator', margin: 'md' },

          // ② 巡り
          {
            type: 'text',
            text: '【 ② 巡り（流れ）の傾向 】',
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

          { type: 'separator', margin: 'md' },

          // ③ 経絡
          {
            type: 'text',
            text: '【 ③ 経絡（偏りの局在）の傾向 】',
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
  const bubbles = cards.map((card) => {
    const bodyContents = [
      {
        type: 'text',
        text: card.body,
        wrap: true,
        color: '#0d0d0d',
        size: 'md',
      },
    ];

    // ✅ 図解ボタンがある場合のみ、区切り線＋ボタンを追加
    if (card.link) {
      bodyContents.push({
        type: 'separator',
        margin: 'md',
      });
      bodyContents.push({
        type: 'button',
        action: {
          type: 'uri',
          label: '📖 図解を見る',
          uri: card.link,
        },
        style: 'primary',
        color: '#7B9E76', // トーン統一
        height: 'sm',
      });
    }

    return {
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
        backgroundColor: '#7B9E76',
        paddingAll: '12px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#F8F9F7',
        paddingAll: '16px',
        spacing: 'md',
        contents: bodyContents,
      },
    };
  });

  return {
    type: 'flex',
    altText,
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
}

function buildCarouselFlex(cards, altText = '分析結果・ととのえ方提案') {
  return buildAdviceCarouselFlex(cards, altText);
}

function buildReminderFlex() {
  return {
    type: 'flex',
    altText: '📊 ととのい度チェックのご案内',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📊ととのい度チェックのご案内',
            weight: 'bold',
            size: 'md',
            color: '#ffffff',
          },
        ],
        backgroundColor: '#7B9E76',
        paddingAll: '12px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: 'こんにちは！お体の調子はいかがですか？\n今週の『ととのい度チェック』がまだでしたら、現状のととのいスコアと今週の優先ケアプランをチェックしてみましょう！🌿',
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
              label: 'ととのい度チェック',
              text: 'ととのい度チェック',
            },
            style: 'primary',
            color: '#7B9E76',
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
        backgroundColor: "#7B9E76", // 落ち着いたアースグリーン27AE60
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
            color: "#7B9E76", // ナチュラルグリーン
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
    altText: '🎁 無料体験開始ボタン',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🎁 16日間の無料体験を始める',
            weight: 'bold',
            size: 'md',
            color: '#ffffff',
          },
        ],
        backgroundColor: '#7B9E76',
        paddingAll: '12px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: '🎁 まずは16日間の無料体験をご利用いただけます！\nご提案した『ととのうケアガイド』の内容を習慣化できるように、AIパートナー『トトノウくん』があなたのケア習慣を手厚くサポート！\n\n✅ 今やったケアをすぐ記録できる『実施記録』機能\n\n📈 毎週の『ととのい度チェック』で、ケア頻度と体調変化を分析し、優先ケアプランを作成\n ⏰ 状態に合わせた『応援レターリマインド』\n 🧠 24時間いつでもトークで質問可能',
            wrap: true,
            color: '#333333',
            size: 'md',
          },
          {
            type: 'separator',
            margin: 'md',
          },
            {
              type: 'text',
              text: '✳️ トライアル終了後の自動課金や強制加入は一切ありませんので安心してご利用ください 🌱',
              size: 'sm',
              color: '#888888',
              wrap: true,
              margin: 'md'
            },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '無料トライアル開始',
              data: 'trial_intro_done',
              displayText: '無料トライアルを開始！',
            },
            style: 'primary',
            color: '#7B9E76',
          },
        ],
      },
    },
  };
}

// トトノウ相談（AIへの質問例Flex）
function buildTotonouConsultExamplesFlex() {
  return {
    type: "flex",
    altText: "トトノウくんに相談してみよう",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🌿 トトノウくんに話しかけてみよう", weight: "bold", size: "md", color: "#ffffff" }
        ],
        backgroundColor: "#7B9E76",
        paddingAll: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "体質や最近の整い度をもとに、AIトトノウくんが何でも答えます！質問メッセージを送るか、以下の参考テーマのボタンを押すと会話が始まります☺️", wrap: true, size: "sm" },
          {
            type: "button",
            style: "primary",
            color: "#7B9E76",
            action: { type: "message", label: "😣 自分の不調と体質の関係", text: "私の不調(主訴)と体質はどう関係あるの？" }
          },
          {
            type: "button",
            style: "primary",
            color: "#7B9E76",
            action: { type: "message", label: "🍴 自分に合う今日の食事", text: "自分に合った今日の食事メニューを考えて！" }
          },
          {
            type: "button",
            style: "primary",
            color: "#7B9E76",
            action: { type: "message", label: "💤 眠りが浅いときの整え方", text: "最近眠りが浅いんだけど、考えられる原因と対策は？" }
          },
          {
            type: "button",
            style: "primary",
            color: "#7B9E76",
            action: { type: "message", label: "🌀 私のストレス対策法", text: "私の体質に合うストレス対処法を教えて！" }
          },
          {
            type: "button",
            style: "primary",
            color: "#7B9E76",
            action: { type: "message", label: "🌿 漢方薬の選び方", text: "最適な漢方薬の選び方を教えてほしい！" }
          }
        ],
      },
    },
  };
}

// utils/flexBuilder.js
function textBlock(text) {
  return { type: "text", text, wrap: true, size: "sm" };
}

function headerBlock(title) {
  return {
    type: "box",
    layout: "vertical",
    contents: [{ type: "text", text: title, weight: "bold", size: "md" }]
  };
}

function sectionCard(title, bodyLines) {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        headerBlock(title),
        { type: "separator", margin: "md" },
        ...bodyLines.map(line => textBlock(line))
      ]
    }
  };
}

/**
 * cards: {card1, card2, card3, header, score, prevScore, delta, stars}
 */
function buildFollowupCarousel(cards) {
  const c1Lines = String(cards.card1 || "").split(/\n+/).slice(0, 6);
  const c2Lines = String(cards.card2 || "").split(/\n+/).slice(0, 8);
  const c3Lines = String(cards.card3 || "").split(/\n+/).slice(0, 8);

  return {
    type: "carousel",
    contents: [
      sectionCard("📋 今回のととのい度", c1Lines),
      sectionCard("🌿 続けるといいこと", c2Lines),
      sectionCard("🌸 次にやってみてほしいこと", c3Lines)
    ]
  };
}

/** GPTメッセージをFlexカード化（ととのいリマインド用） */
function buildReminderFlexFromText(text) {
  if (!text) return null;

  const parts = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const [intro, learning, hint, outro] = parts;

  return {
    type: "flex",
    altText: "今週のととのうケアレター🌿",
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: "https://totonoucare.com/wp-content/themes/totonoucare/images/flex-hero-autumn.gif",
        size: "full",
        aspectMode: "cover",
        aspectRatio: "16:9"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🌿 今週のととのうケアレター", weight: "bold", size: "md", color: "#5A745C" },
          { type: "text", text: intro || "", wrap: true, size: "md", margin: "md" },
          { type: "separator", margin: "md" },
          { type: "text", text: learning || "", wrap: true, size: "md", margin: "md" },
          { type: "text", text: hint || "", wrap: true, size: "md", margin: "md" },
          { type: "separator", margin: "md" },
          { type: "text", text: outro || "次のととのい度チェックに向けて、今週も自分のペースで整えていきましょうね🌿", wrap: true, size: "md", margin: "md", color: "#4D5F4A" }
        ]
      },
      footer: {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#7B9E76",
            action: {
              type: "message",
              label: "トトノウくんに相談 💬",
              text: "トトノウくんに相談"
            }
          }
        ]
      }
    }
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
  buildReminderFlexFromText,
  buildTrialStartFlex, 
  buildResultFlex, 
  buildFollowupCarousel,
  buildTotonouConsultExamplesFlex
};

