// ========================================
// ✅ リッチ版 MessageBuilder（質問・選択UI共通）
// - 進行表示：0/5〜5/5
// - 本文/ボタンラベル：md（sm禁止）
// ========================================
function MessageBuilder({
  altText,
  header,
  subHeader = null,
  stepLabel = null,          // 例: "0/5"
  body,
  note = null,
  buttons = [],              // { label, data, displayText, emoji }
  hintText = "👇 気になるテーマを1つ選んでください",
  theme = {
    headerBg: "#7B9E76",
    bodyBg: "#F8F9F7",
    cardBg: "#FFFFFF",
    border: "#DDE6DB",
    accent: "#7B9E76",
    text: "#0d0d0d",
    muted: "#777777",
  },
}) {
  const actionRows = (buttons || []).map((btn) => {
    const label = String(btn.label || "");
    const emoji = btn.emoji ? String(btn.emoji) : "🌿";

    return {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      paddingAll: "12px",
      backgroundColor: theme.cardBg,
      cornerRadius: "12px",
      borderWidth: "1px",
      borderColor: theme.border,
      action: {
        type: "postback",
        label,
        data: btn.data,
        displayText: btn.displayText ?? label,
      },
      contents: [
        { type: "text", text: emoji, size: "md", flex: 0 },
        {
          type: "text",
          text: label,
          size: "md",            // ✅ md
          weight: "bold",
          color: theme.text,
          wrap: true,
          flex: 1,
        },
        {
          type: "text",
          text: "›",
          size: "xl",
          color: theme.accent,
          align: "end",
          flex: 0,
        },
      ],
    };
  });

  return {
    type: "flex",
    altText,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        backgroundColor: theme.headerBg,
        paddingAll: "14px",
        contents: [
          ...(stepLabel
            ? [
                {
                  type: "text",
                  text: stepLabel,     // 例: "0/5"
                  size: "md",          // ✅ md（読みやすく）
                  color: "#ffffff",
                  weight: "bold",
                },
              ]
            : []),
          {
            type: "text",
            text: header,
            weight: "bold",
            size: "lg",
            color: "#ffffff",
            wrap: true,
          },
          ...(subHeader
            ? [
                {
                  type: "text",
                  text: subHeader,
                  size: "md",          // ✅ md
                  color: "#F1F6F1",
                  wrap: true,
                },
              ]
            : []),
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: theme.bodyBg,
        paddingAll: "16px",
        spacing: "md",
        contents: [
          // 本文カード
          {
            type: "box",
            layout: "vertical",
            backgroundColor: theme.cardBg,
            cornerRadius: "12px",
            paddingAll: "12px",
            borderWidth: "1px",
            borderColor: theme.border,
            contents: [
              {
                type: "text",
                text: body,
                wrap: true,
                color: theme.text,
                size: "md",          // ✅ md
              },
              ...(note
                ? [
                    {
                      type: "text",
                      text: note,
                      wrap: true,
                      color: theme.muted,
                      size: "md",       // ✅ md
                      margin: "md",
                    },
                  ]
                : []),
            ],
          },

          { type: "separator", margin: "md" },

          // 選択肢エリアの導線文
          {
            type: "text",
            text: hintText,
            size: "md",             // ✅ md
            color: theme.muted,
            wrap: true,
          },
          ...actionRows,
        ],
      },
    },
  };
}

function injectContext(template, context = {}) {
  return String(template || "").replace(
    /\{\{(.*?)\}\}/g,
    (_, key) => context[key] ?? `{{${key}}}`
  );
}

// ========================================
// ✅ カテゴリ選択：0/5
// ========================================
function buildCategorySelectionFlex() {
  const categories = [
    { label: "胃腸の調子", data: "stomach", displayText: "胃腸の調子", emoji: "🍵" },
    { label: "睡眠・集中力", data: "sleep", displayText: "睡眠・集中力", emoji: "🌙" },
    { label: "肩こり・腰痛・関節痛", data: "pain", displayText: "肩こり・腰痛・関節痛", emoji: "🧍‍♀️" },
    { label: "イライラや不安感", data: "mental", displayText: "イライラや不安感", emoji: "🫧" },
    { label: "体温バランス・むくみ", data: "cold", displayText: "体温バランス・むくみ", emoji: "🧊" },
    { label: "頭髪や肌の健康", data: "skin", displayText: "頭髪や肌の健康", emoji: "🧴" },
    { label: "花粉症・鼻炎", data: "pollen", displayText: "花粉症・鼻炎", emoji: "🌼" },
    { label: "女性特有のお悩み", data: "women", displayText: "女性特有のお悩み", emoji: "🌙" },
    { label: "なんとなく不調・不定愁訴", data: "unknown", displayText: "なんとなく不調・不定愁訴", emoji: "🌿" },
  ];

  return MessageBuilder({
    altText: "ととのえタイプ分析を開始します。どの不調が気になりますか？",
    stepLabel: "0/5",
    header: "ととのえタイプ分析スタート",
    subHeader: "いま一番気になるお悩みを選ぶところから始めます",
    body: "どんなお悩みを“ととのえたい”ですか？\nいちばん気になるものを1つ選んでください。",
    note: "※別のテーマで分析をやり直したい場合は、分析完了後にもう一度『ととのえタイプ再分析』からやり直せます",
    buttons: categories,
    theme: {
      headerBg: "#7B9E76",
      bodyBg: "#F8F9F7",
      cardBg: "#FFFFFF",
      border: "#DDE6DB",
      accent: "#7B9E76",
      text: "#0d0d0d",
      muted: "#777777",
    },
  });
}

// ========================================
// ✅ 質問本体：questionFunction側が返すflexを「1/5〜5/5」に上書き可能にする
// - questionFunctionが MessageBuilder を使っていない場合でも安全に通す
// ========================================
function extractStepFromHeaderText(headerText) {
  // "【Q1】..." / "Q1" / "1" などを雑に拾う
  const s = String(headerText || "");
  const m1 = s.match(/Q(\d+)/);
  if (m1) return Number(m1[1]);
  const m2 = s.match(/【(\d+)】/);
  if (m2) return Number(m2[1]);
  return null;
}

function applyProgressLabelToFlex(flex, total = 5) {
  try {
    const headerBox = flex?.contents?.header;
    if (!headerBox?.contents?.length) return flex;

    // headerの先頭textを見てQ番号を推定
    const firstText = headerBox.contents.find((c) => c?.type === "text" && typeof c.text === "string");
    const step = extractStepFromHeaderText(firstText?.text);

    // 1〜5以外は触らない
    if (!step || step < 1 || step > total) return flex;

    // すでに stepLabel 行がある想定ならその行を書き換え、無ければ先頭に挿入
    // stepLabel行は「md/白/太字」で "1/5" の形式にする
    const progressText = `${step}/${total}`;

    const maybeProgress = headerBox.contents[0];
    const looksLikeProgress =
      maybeProgress?.type === "text" &&
      typeof maybeProgress.text === "string" &&
      maybeProgress.text.includes("/");

    if (looksLikeProgress) {
      headerBox.contents[0].text = progressText;
      headerBox.contents[0].size = "md";
      headerBox.contents[0].weight = "bold";
      headerBox.contents[0].color = "#ffffff";
    } else {
      headerBox.contents.unshift({
        type: "text",
        text: progressText,
        size: "md",
        color: "#ffffff",
        weight: "bold",
      });
    }
  } catch (_) {}

  return flex;
}

// 既存の buildQuestionFlex を差し替え（progress適用）
async function buildQuestionFlex(questionFunction) {
  try {
    const flex = await questionFunction();
    // ✅ ここで 1/5〜5/5 を付与
    return applyProgressLabelToFlex(flex, 5);
  } catch (error) {
    console.error("❌ 質問関数の実行エラー", error);
    return {
      type: "text",
      text: "ごめんなさい、質問の取得に失敗しました。もう一度試してください。",
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

function buildTrialStartFlex() {
  return {
    type: "flex",
    altText: "🎁 無料体験を有効化して、ととのい度チェックを始めよう",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "14px",
        backgroundColor: "#C6A047", // gold
        contents: [
          {
            type: "text",
            text: "🎁 無料体験を有効化して、\nととのい度チェックを始めよう",
            weight: "bold",
            size: "md",
            color: "#FFFFFF",
            wrap: true,
          },
          {
            type: "text",
            text: "（16日間・自動課金なし）",
            size: "xs",
            color: "#FFFFFF",
            margin: "sm",
            wrap: true,
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "16px",
        backgroundColor: "#FDFBF7", // cream
        contents: [
          {
            type: "text",
            text:
              "無料体験を有効化すると、あなたの体質データをもとにした有料機能が使えるようになります。\nまずは「今の状態」を1分でチェックして、整いの変化を追える状態にしましょう🌿",
            size: "sm",
            color: "#333333",
            wrap: true,
          },

          { type: "separator", margin: "md" },

          {
            type: "text",
            text: "使える機能：",
            size: "sm",
            weight: "bold",
            color: "#5A4A2A",
            wrap: true,
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "📈 ととのい度チェック：最近の体調・生活・動きの負担を記録して、変化を見える化",
                size: "sm",
                color: "#333333",
                wrap: true,
              },
              {
                type: "text",
                text: "🪴 実施記録：やれた日を残して、ケアの反映具合を読み取りやすくする",
                size: "sm",
                color: "#333333",
                wrap: true,
              },
              {
                type: "text",
                text: "📬 からだの巡り通信：チェックや記録をもとに、最近のゆらぎ・崩れやすいポイントを短く通知",
                size: "sm",
                color: "#333333",
                wrap: true,
              },
              {
                type: "text",
                text: "🧠 トトノウくん相談：体質データ込みで、気になることをいつでも相談",
                size: "sm",
                color: "#333333",
                wrap: true,
              },
            ],
          },

          { type: "separator", margin: "md" },

          {
            type: "text",
            text:
              "✳️ 無料体験の終了後に自動課金や強制加入はありません。安心して試してくださいね🌱",
            size: "xs",
            color: "#888888",
            wrap: true,
          },

          {
            type: "button",
            style: "primary",
            color: "#B78949", // deep gold
            action: {
              type: "postback",
              label: "ととのい度チェックをする",
              data: "trial_intro_done",
              displayText: "ととのい度チェックをする",
            },
          },

          {
            type: "text",
            text:
              "※ ボタンを押すと無料体験が有効化され、そのままチェックに進めます。",
            size: "xs",
            color: "#888888",
            wrap: true,
          },
        ],
      },
    },
  };
}

function buildTrialOnboardingCarouselFlex() {
  const bubble1 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "🎁 無料体験が開始されました", weight: "bold", size: "md", color: "#ffffff" }
      ],
      backgroundColor: "#7B9E76",
      paddingAll: "12px",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "さっそく「今の現在地」の1分チェックで、整いの変化を追える状態にしましょう🌿", wrap: true, size: "sm" },
        { type: "separator", margin: "md" },
        {
          type: "button",
          style: "primary",
          color: "#7B9E76",
          action: {
            type: "message",
            label: "ととのい度チェック開始",
            text: "ととのい度チェック開始",
          },
        },
        { type: "text", text: "※メニューの【ととのい度チェック】からもできます", wrap: true, size: "xs", color: "#888888" },
      ],
    },
  };

  const bubble2 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "🪴 実施記録（ケアログ）", weight: "bold", size: "md", color: "#ffffff" }
      ],
      backgroundColor: "#C6A047",
      paddingAll: "12px",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "やった日は“1日1回”でOK。続けた日数が見える化されます。", wrap: true, size: "sm" },
        { type: "separator", margin: "md" },
        { type: "text", text: "記録はメニューの【実施記録】からいつでも📌", wrap: true, size: "sm" },
      ],
    },
  };

  const bubble3 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "💬 トトノウくんに相談", weight: "bold", size: "md", color: "#ffffff" }
      ],
      backgroundColor: "#4D6A72",
      paddingAll: "12px",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "体質データと最近の記録を踏まえて、相談に答えます🧠", wrap: true, size: "sm" },
        { type: "separator", margin: "md" },
        {
          type: "button",
          style: "primary",
          color: "#4D6A72",
          action: {
            type: "message",
            label: "おすすめ質問を見る",
            text: "トトノウくんに相談",
          },
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: "無料体験の使い方",
    contents: {
      type: "carousel",
      contents: [bubble1, bubble2, bubble3],
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
// ととのうケアガイド（カルーセル生成）— リッチ版
// ========================================
function buildAdviceCarouselFlex(cards, altText = "あなた専用ととのうケアガイド") {
  const arr = Array.isArray(cards) ? cards : [];

  // 文章を「【やり方】【効果】【目安】」などの見出しで分割
  function splitSections(text) {
    const t = String(text || "").trim();
    if (!t) return [];

    const re = /【([^】]+)】/g;
    const matches = [...t.matchAll(re)];
    if (matches.length === 0) {
      // 見出しが無ければ、そのまま1セクション扱い
      return [{ title: null, body: t }];
    }

    const sections = [];
    for (let i = 0; i < matches.length; i++) {
      const title = matches[i][1]?.trim() || null;
      const start = matches[i].index + matches[i][0].length;
      const end = (i + 1 < matches.length) ? matches[i + 1].index : t.length;
      const body = t.slice(start, end).trim();
      if (title || body) sections.push({ title, body });
    }
    return sections.length ? sections : [{ title: null, body: t }];
  }

  // 長文をFlexの複数textに分割（読みやすく＆折り返し事故減らす）
  function toTextBlocks(text, { size = "sm", color = "#222222" } = {}) {
    const t = String(text || "").trim();
    if (!t) return [];
    const parts = t.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);

    return parts.map((p) => ({
      type: "text",
      text: p,
      wrap: true,
      size,
      color,
      lineSpacing: "4px",
    }));
  }

  function sectionBlock(title, body, accentColor) {
    const titleRow = title
      ? [{
          type: "box",
          layout: "baseline",
          spacing: "sm",
          contents: [
            { type: "text", text: "●", size: "sm", color: accentColor, flex: 0 },
            { type: "text", text: title, size: "sm", weight: "bold", color: "#111111", wrap: true },
          ],
        }]
      : [];

    return {
      type: "box",
      layout: "vertical",
      backgroundColor: "#FFFFFF",
      cornerRadius: "12px",
      paddingAll: "12px",
      spacing: "sm",
      contents: [
        ...titleRow,
        ...toTextBlocks(body, { size: "sm", color: "#222222" }),
      ],
    };
  }

  const bubbles = arr.map((card, index) => {
    const isPriority = index === 0 || index === 1;

    const theme = isPriority
      ? {
          headerBg: "#2F5E3A",   // 濃いめグリーン
          badgeBg: "#D6B45A",    // ゴールド
          badgeText: "最優先ケア",
          accent: "#B78949",     // ゴールド寄りアクセント
          bodyBg: "#F8F9F7",
          button: "#2F5E3A",
        }
      : {
          headerBg: "#7B9E76",
          badgeBg: "#E9E2C8",
          badgeText: "サポートケア",
          accent: "#7B9E76",
          bodyBg: "#F8F9F7",
          button: "#7B9E76",
        };

    const bodyContents = [];

    // --- 上部：バッジ＋短い説明（intro/explain）を「カード風」にまとめる
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "box",
          layout: "vertical",
          backgroundColor: theme.badgeBg,
          cornerRadius: "999px",
          paddingAll: "6px",
          paddingStart: "10px",
          paddingEnd: "10px",
          contents: [
            {
              type: "text",
              text: theme.badgeText,
              size: "xs",
              weight: "bold",
              color: "#1F2A1F",
              wrap: false,
            },
          ],
          flex: 0,
        },
        { type: "filler" },
        {
          type: "text",
          text: `${index + 1}/${arr.length}`,
          size: "xs",
          color: "#888888",
          align: "end",
        },
      ],
      margin: "none",
    });

// intro / explain を “まとめカード” として表示
const introText = String(card?.intro || "").trim();
const explainText = String(card?.explain || "").trim();
const leadParts = [introText, explainText].filter(Boolean);

if (leadParts.length) {
  bodyContents.push({
    type: "box",
    layout: "vertical",
    backgroundColor: "#FFFFFF",
    cornerRadius: "12px",
    paddingAll: "12px",
    margin: "md",
    spacing: "sm",
    contents: leadParts.flatMap((t, i) => ([
      {
        type: "text",
        text: t,
        wrap: true,
        size: "xs",          // ← 小さく
        weight: "bold",      // ← 太字
        color: "#222222",
        lineSpacing: "4px",
      },
      ...(i < leadParts.length - 1 ? [{ type: "separator", margin: "md" }] : []),
    ])),
  });
}

    // --- 本文：セクション化（【やり方】【効果】【目安】など）
    const sections = splitSections(card?.body);
    if (sections.length) {
      bodyContents.push({ type: "separator", margin: "lg" });

      for (const s of sections) {
        bodyContents.push(sectionBlock(s.title, s.body, theme.accent));
        bodyContents.push({ type: "separator", margin: "md" });
      }
      // 末尾のseparatorが余るので削除
      if (bodyContents.length && bodyContents[bodyContents.length - 1]?.type === "separator") {
        bodyContents.pop();
      }
    }

    // --- 図解ボタン（footerに寄せて“リッチ感”）
    const hasLink = !!String(card?.link || "").trim();
    const footer = hasLink
      ? {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "button",
              action: {
                type: "uri",
                label: "📖 図解を見る",
                uri: card.link,
              },
              style: "primary",
              color: theme.button,
              height: "sm",
            },
            {
              type: "text",
              text: "※ 図解はブラウザで開きます",
              size: "xs",
              color: "#888888",
              wrap: true,
            },
          ],
        }
      : undefined;

    return {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: theme.headerBg,
        paddingAll: "14px",
        contents: [
          {
            type: "text",
            text: String(card?.header || "ととのうケアガイド"),
            weight: "bold",
            size: "md",
            color: "#FFFFFF",
            wrap: true,
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: theme.bodyBg,
        paddingAll: "16px",
        spacing: "md",
        contents: bodyContents,
      },
      ...(footer ? { footer } : {}),
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

// utils/flexBuilder.js の一部として

function buildReminderFlexFromText(letterText) {
  const raw = (letterText || "").trim();
  if (!raw) return null; // 空ならテキストfallbackに任せる

  // 🔹 段落単位に分割（空行で区切る）
  const paragraphs = raw
    .split(/\n{2,}/)        // 2行以上の連続改行で分割
    .map((p) => p.trim())
    .filter((p) => p.length > 0); // 完全な空文字は捨てる

  if (paragraphs.length === 0) return null;

  const contents = [];

  paragraphs.forEach((p, idx) => {
    // 先頭以外の段落の前にセパレーターを挿入
    if (idx !== 0) {
      contents.push({
        type: "separator",
        margin: "md",
      });
    }

    contents.push({
      type: "text",
      text: p,
      wrap: true,
      size: "md",
      margin: "md",
    });
  });

  return {
    type: "flex",
    altText: "からだの巡り通信🌿",
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
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "📬 からだの巡り通信",
            weight: "bold",
            size: "md",
            color: "#5A745C",
            wrap: true,
          },
          ...contents,
        ],
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
  // 既存のエクスポートと一緒に
  buildReminderFlexFromText,
  // buildReminderFlex など他の関数もここに並べる
};

module.exports = {
  MessageBuilder,
  buildCategorySelectionFlex,
  buildQuestionFlex,
  buildTrialOnboardingCarouselFlex,
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

