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
            text: "🌱 ととのえタイプ分析が初めての方は、そのまま分析をスタートしてください",
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
            text: "✍️ 再分析の場合は、今回の分析結果が前回の結果記録に上書き保存されます。\n 「回答し直したい」／「体の状態が変化したため分析し直したい」という時にご使用ください！",
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
    type: "flex",
    altText: `分析結果：${result.type}／${result.symptomLabel}`,
    contents: {
      type: "bubble",
      size: "mega",

      // ================================
      // 🟩 ヘッダー
      // ================================
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `📝 【 ${result.type} 】`,
            weight: "bold",
            size: "lg",
            color: "#ffffff",
          },
        ],
        backgroundColor: "#7B9E76",
        paddingAll: "12px",
      },

      // ================================
      // 🟦 ボディ
      // ================================
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        backgroundColor: "#F8F9F7",
        paddingAll: "18px",
        contents: [

          // 画像
          {
            type: "image",
            url: imageUrl,
            size: "full",
            aspectRatio: "1:1",
            aspectMode: "cover"
          },

          { type: "separator", margin: "lg" },

          // 主訴
          {
            type: "text",
            text: `【 📝 今回のお悩み 】`,
            weight: "bold",
            size: "sm",
            color: "#0d0d0d",
          },
          {
            type: "text",
            text: result.symptomLabel,
            wrap: true,
            size: "md",
            color: "#333333",
          },

          { type: "separator", margin: "lg" },

          {
            type: "text",
            text: "【 🧭 今の状態のまとめ 】",
            weight: "bold",
            size: "sm",
            color: "#0d0d0d",
          },

          // ================================
          // ⭐ overviewParts を描画（辞書部分だけ枠つき）
          // ================================
          ...result.overviewParts.map((p) => {
            if (p.type === "separator") {
              return {
                type: "separator",
                margin: "lg",
              };
            }

            // ▼ 普通の接続文（太字 or 通常）→ そのまま表示
            if (!p.box) {
              return {
                type: "text",
                text: p.text,
                wrap: true,
                size: "sm",
                weight: p.bold ? "bold" : "regular",
                color: "#333333",
              };
            }

            // ▼ 辞書本文（traits / flowIssue / organInfo）→ 枠で囲む
            return {
              type: "box",
              layout: "vertical",
              backgroundColor: "#ffffff",
              borderColor: "#D7DED4",
              borderWidth: "1px",
              cornerRadius: "8px",
              paddingAll: "12px",
              contents: [
                {
                  type: "text",
                  text: p.text,
                  wrap: true,
                  size: "md",
                  color: "#333333",
                },
              ],
            };
          }),
        ],
      },
    },
  };
}

// ========================================
// ととのうケアガイド（カルーセル生成）
// ========================================
function buildAdviceCarouselFlex(cards, altText = "あなた専用ととのうケアガイド") {
  const bubbles = cards.map((card, index) => {
    const isPriority = index === 0 || index === 1;

    const bodyContents = [];

    // ---------------------------
    // 🥇 優先ケア 前置き（box 包み）
    // ---------------------------
    if (card.intro) {
      bodyContents.push({
        type: "box",
        layout: "vertical",
        margin: "none",
        contents: [
          {
            type: "text",
            text: card.intro,
            wrap: true,
            weight: "bold",
            size: "sm",
            color: "#333333"
          }
        ]
      });

      bodyContents.push({
        type: "separator",
        margin: "md",
      });
    }

    // ---------------------------
    // 📘 ケア固有説明（box 包み）
    // ---------------------------
    if (card.explain) {
      bodyContents.push({
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: card.explain,
            wrap: true,
            weight: "bold",
            size: "sm",
            color: "#333333",
          }
        ]
      });

      bodyContents.push({
        type: "separator",
        margin: "md",
      });
    }

    // ---------------------------
    // 📚 辞書本文（これは直接 text でOK）
    // ---------------------------
    bodyContents.push({
      type: "text",
      text: card.body,
      wrap: true,
      size: "md",
      color: "#0d0d0d",
    });

    // ---------------------------
    // 📖 図解ボタン
    // ---------------------------
    if (card.link) {
      bodyContents.push({
        type: "separator",
        margin: "md",
      });
      bodyContents.push({
        type: "button",
        action: {
          type: "uri",
          label: "📖 図解を見る",
          uri: card.link,
        },
        style: "primary",
        color: "#7B9E76",
        height: "sm",
      });
    }

    return {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: card.header,
            weight: "bold",
            size: "md",
            color: "#ffffff",
          },
        ],
        backgroundColor: isPriority ? "#5F7F59" : "#7B9E76",
        paddingAll: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#F8F9F7",
        paddingAll: "16px",
        spacing: "md",
        contents: bodyContents,
      },
    };
  });

  return {
    type: "flex",
    altText,
    contents: {
      type: "carousel",
      contents: bubbles,
    },
  };
}

function buildCarouselFlex(cards, altText = "分析結果・ととのえ方提案") {
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
    altText: "トトノウくん活用ガイド",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "10px",
        backgroundColor: "#7B9E76",
        contents: [
          {
            type: "text",
            text: "🌱 AIトトノウくん活用ガイド",
            weight: "bold",
            size: "md",
            color: "#FFFFFF",
          },
          {
            type: "text",
            text: "体の“地図”×“現在地”×“足あと”を読んで整え方を案内します",
            size: "xs",
            color: "#F0F0F0",
            wrap: true
          }
        ],
      },

      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [

          // 1
          {
            type: "box",
            layout: "vertical",
            paddingAll: "8px",
            backgroundColor: "#f6f6f4",
            cornerRadius: "6px",
            contents: [
              { type: "text", text: "① 不調を言語化したいとき🩺", weight: "bold", size: "sm" },
              { type: "text", text: "最近の体の変化や“なんとなく不調”を整理して、原因の方向性を一緒に見つけます。", wrap: true, size: "xs" },
              {
                type: "button",
                style: "primary",
                color: "#7B9E76",
                margin: "sm",
                action: {
                  type: "message",
                  label: "不調について相談する",
                  text: "今の不調について相談したいです。原因やケア方針を整理してほしいです。"
                }
              }
            ]
          },

          // 2
          {
            type: "box",
            layout: "vertical",
            paddingAll: "8px",
            backgroundColor: "#f6f6f4",
            cornerRadius: "6px",
            contents: [
              { type: "text", text: "② 今はどのケアを優先すべき？⚖️", weight: "bold", size: "sm" },
              { type: "text", text: "体質＋最近の状態から、優先ケアとサポートケアの使い分けを案内します。", wrap: true, size: "xs" },
              {
                type: "button",
                style: "primary",
                color: "#7B9E76",
                margin: "sm",
                action: {
                  type: "message",
                  label: "優先するケアを知りたい",
                  text: "今の状態での優先ケアとサポートケアの使い分けを相談したいです。"
                }
              }
            ]
          },

          // 3
          {
            type: "box",
            layout: "vertical",
            paddingAll: "8px",
            backgroundColor: "#f6f6f4",
            cornerRadius: "6px",
            contents: [
              { type: "text", text: "③ 続かない・サボりがちの立て直し🔁", weight: "bold", size: "sm" },
              { type: "text", text: "習慣が続かないときの“ハードルの下げ方”や工夫を一緒に考えます。", wrap: true, size: "xs" },
              {
                type: "button",
                style: "primary",
                color: "#7B9E76",
                margin: "sm",
                action: {
                  type: "message",
                  label: "続かないときの相談",
                  text: "セルフケアが続けられません。無理なく続ける工夫を相談したいです。"
                }
              }
            ]
          },

          // 4
          {
            type: "box",
            layout: "vertical",
            paddingAll: "8px",
            backgroundColor: "#f6f6f4",
            cornerRadius: "6px",
            contents: [
              { type: "text", text: "④ ケア効果の反映具合を知りたい✨", weight: "bold", size: "sm" },
              { type: "text", text: "前回と今回の“ととのい度の差”と、ケアログの積み上がりからレポートします。", wrap: true, size: "xs" },
              {
                type: "button",
                style: "primary",
                color: "#7B9E76",
                margin: "sm",
                action: {
                  type: "message",
                  label: "ケア効果の反映具合を聞く",
                  text: "ケア効果の反映具合を聞く"
                }
              }
            ]
          },

          // 5
          {
            type: "box",
            layout: "vertical",
            paddingAll: "8px",
            backgroundColor: "#f6f6f4",
            cornerRadius: "6px",
            contents: [
              { type: "text", text: "⑤ 体質に合う献立・食べ方の相談🥗", weight: "bold", size: "sm" },
              { type: "text", text: "体質タイプに応じて食材やメニューの方向性を提案します。", wrap: true, size: "xs" },
              {
                type: "button",
                style: "primary",
                color: "#7B9E76",
                margin: "sm",
                action: {
                  type: "message",
                  label: "献立の相談をする",
                  text: "体質に合う食べ方や献立の方向性を相談したいです。"
                }
              }
            ]
          },

          // 6
          {
            type: "box",
            layout: "vertical",
            paddingAll: "8px",
            backgroundColor: "#f6f6f4",
            cornerRadius: "6px",
            contents: [
              { type: "text", text: "⑥ リスク予兆の可視化👁️", weight: "bold", size: "sm" },
              { type: "text", text: "最近の体調や気分の“ちょっとした違和感”を、体質データと照らし合わせて整理し、崩れやすいポイントを一緒に見つけます。", wrap: true, size: "xs" },
              {
                type: "button",
                style: "primary",
                color: "#7B9E76",
                margin: "sm",
                action: {
                  type: "message",
                  label: "リスク予兆を知りたい",
                  text: "最近の体や気分のゆらぎから、崩れやすいポイントやリスクの予兆があるか相談したいです。どこに気をつけると良さそうですか？"
                }
              }
            ]
          },

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

// GPTレター文字列 → 今週のととのうケアレター Flex に変換
function buildReminderFlexFromText(text) {
  const raw = (text || "").trim();
  if (!raw) return null; // 中身なければテキスト送信 fallback

  // 段落に分割（空行で区切る想定）＋空行は削除
  const paragraphs = raw
    .split(/\n{2,}/)          // 2行以上の改行で段落区切り
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const bodyContents = [];

  // タイトル
  bodyContents.push({
    type: "text",
    text: "🌿 今週のととのうケアレター",
    weight: "bold",
    size: "md",
    color: "#5A745C",
  });

  // 段落を順番に追加（空文字はそもそも入ってこない）
  paragraphs.forEach((p, idx) => {
    if (idx === 0) {
      // 1つ目の段落
      bodyContents.push({
        type: "text",
        text: p,
        wrap: true,
        size: "md",
        margin: "md",
      });
    } else {
      // 2つ目以降の段落は区切り線を挟んで追加
      bodyContents.push({ type: "separator", margin: "md" });
      bodyContents.push({
        type: "text",
        text: p,
        wrap: true,
        size: "md",
        margin: "md",
      });
    }
  });

  // ※「次のととのい度チェックに向けて〜」みたいな固定文はここでは入れない
  //   レター自体を「理由がわかる一通の手紙」に振り切る設計

  return {
    type: "flex",
    altText: "今週のととのうケアレター🌿",
    contents: {
      type: "bubble",
      size: "mega",
      hero: {
        type: "image",
        url: "https://totonoucare.com/wp-content/themes/totonoucare/images/flex-hero-autumn.gif",
        size: "full",
        aspectMode: "cover",
        aspectRatio: "16:9",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: bodyContents,
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
              text: "トトノウくんに相談",
            },
          },
        ],
      },
    },
  };
}

module.exports = {
  // 既存のエクスポートにこれを足す or 差し替え
  buildReminderFlex,
  buildReminderFlexFromText,
  // 他の関数たち…
};

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

