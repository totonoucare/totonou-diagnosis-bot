// followup/index.js
// ===============================================
// 「ととのい度チェック」週次チェックフロー（最終仕様）
// Q1: 主訴ふくむ体調 / Q2: 生活リズム / Q3: 動作テスト
// - 全て isMulti=true 形式
// - 回答完了後、トトノウくんGPTで2枚カード(JSON)生成
// - pushはカルーセル(2バブル: 状態まとめ＋ケアプラン)
// ===============================================

const questionSets = require("./questionSets");
const handleFollowupAnswers = require("./followupRouter");
const supabaseMemoryManager = require("../supabaseMemoryManager");
const { buildMultiQuestionFlex } = require("../utils/flexBuilder");

// ======== ラベル定義 ========
const symptomLabels = {
  stomach: "胃腸の調子",
  sleep: "睡眠・集中力",
  pain: "肩こり・腰痛・関節",
  mental: "イライラや不安感",
  cold: "体温バランス・むくみ",
  skin: "頭髪や肌の健康",
  pollen: "花粉症・鼻炎",
  women: "女性特有のお悩み",
  unknown: "なんとなく不調・不定愁訴",
};

const motionLabels = {
  A: "首を後ろに倒すor左右に回す",
  B: "腕をバンザイする",
  C: "前屈する",
  D: "腰を左右にねじるor側屈",
  E: "上体をそらす",
};

const multiLabels = {
  symptom: "「{{symptom}}」を含む体調レベル",
  sleep: "睡眠の状態",
  meal: "食事の状態",
  stress: "ストレスの状態",
  motion_level: "動作テストの変化",
};

// ======== セッション管理 ========
const userSession = {};

// ======== テンプレ置換 ========
function replacePlaceholders(template, context = {}) {
  if (!template || typeof template !== "string") return "";

  return template
    .replace(/\{\{symptom\}\}/g, symptomLabels[context.symptom] || "不明な主訴")
    .replace(/\{\{motion\}\}/g, context.motion || "指定の動作");
}

// ======== GPT出力→Flex変換 ========
function buildResultFlexBubbles(sections) {
  const card1 = sections?.card1 || {};
  const card2 = sections?.card2 || {};

  // --- スコア部分（上部に配置するメインブロック） ---
  const scoreAction = card1.score_block?.action;
  const scoreEffect = card1.score_block?.effect;

  const scoreBlock = {
    type: "box",
    layout: "vertical",
    alignItems: "center",
    contents: [
      // 💪 ケア実施努力点
      {
        type: "text",
        text: scoreAction
          ? `💪 ${scoreAction.label}：${scoreAction.score_text}`
          : "💪 ケア実施努力点：--",
        size: "lg",             // ← 1段目
        weight: "bold",
        color: "#C6A047",
        align: "center",
        wrap: false,            // ← 改行防止
      },
      // 💫 ケア効果反映度（ラベルのみ）
      {
        type: "text",
        text: scoreEffect
          ? `💫 ${scoreEffect.label}：`
          : "💫 ケア効果反映度：",
        size: "lg",             // ← 2段目ラベル
        weight: "bold",
        color: "#C6A047",
        align: "center",
        wrap: false,
        margin: "sm",
      },
      // ★★★☆☆（星を大きめに）
      {
        type: "text",
        text: scoreEffect?.stars || "☆☆☆☆☆",
        size: "xxl",            // ← 星の段は大きめ
        weight: "bold",
        color: "#C6A047",
        align: "center",
        wrap: false,
        margin: "xs",
      },
    ],
  };

  // --- bubble1: 状態まとめ ---
  const bubble1 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "📋 今回のととのい度チェック",
          weight: "bold",
          size: "lg",
          color: "#ffffff",
        },
      ],
      backgroundColor: "#7B9E76",
      paddingAll: "12px",
      cornerRadius: "12px",
    },
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#F8F9F7",
      paddingAll: "12px",
      contents: [
        scoreBlock,
        { type: "separator", margin: "lg" }, // ← スコア後の区切りを広めに
        {
          type: "text",
          text: card1.lead || "おつかれさまでした😊",
          wrap: true,
          size: "md",
          color: "#333333",
        },
        { type: "separator", margin: "lg" }, // ← リードとガイダンスの間も広め
        {
          type: "text",
          text: card1.guidance || "今の流れを保っていこう🌿",
          wrap: true,
          size: "md",
          color: "#333333",
        },
      ],
    },
  };



  // --- bubble2: ケアプラン
  const carePlanList = Array.isArray(card2.care_plan) ? card2.care_plan : [];
  const careContents = [
    { type: "text", text: card2.lead || "今週はこの順で整えていこう🌿", wrap: true },
  ];

carePlanList
  .sort((a, b) => (a.priority || 999) - (b.priority || 999))
  .forEach((p) => {
    careContents.push({
      type: "box",
      layout: "vertical",
      margin: "md",
      contents: [
        {
          type: "text",
          text: `【${p.priority || 1}位】${p.pillar}（${p.recommended_frequency || "目安"}）`,
          weight: "bold",
          wrap: true,
        },
        {
          type: "text",
          text: p.reason || "",
          wrap: true,
        },
        ...(typeof p.reference_link === "string" && /^https?:\/\//.test(p.reference_link)
          ? [
              {
                type: "button",
                style: "link",
                height: "sm",
                action: {
                  type: "uri",
                  label: "図解を見る",
                  uri: p.reference_link,
                },
              },
            ]
          : []),
      ],
    });
  });

  careContents.push({ type: "separator", margin: "md" });
  careContents.push({
    type: "text",
    text: card2.footer || "焦らず、今週もマイペースで🫶",
    wrap: true,
    size: "xs",
    color: "#888888",
  });

  const bubble2 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "🪴 今週のケアプラン", weight: "bold", size: "lg", color: "#ffffff" },
      ],
      backgroundColor: "#C6A047",
      paddingAll: "12px",
      cornerRadius: "12px",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      backgroundColor: "#FDFBF7",
      paddingAll: "12px",
      contents: careContents,
    },
  };

  return [bubble1, bubble2];
}

// ======== Flex質問構築 ========
function buildFlexMessage(question, context = {}) {
  return buildMultiQuestionFlex({
    altText: replacePlaceholders(question.header, context),
    header: replacePlaceholders(question.header, context),
    body: replacePlaceholders(question.body, context),
    questions: question.options.map((opt) => ({
      key: opt.id,
      title: replacePlaceholders(multiLabels[opt.id] || opt.label || opt.id, context),
      items: opt.items,
    })),
  });
}

// ======== メイン処理 ========
async function handleFollowup(event, client, lineId) {
  const replyToken = event.replyToken;
  try {
    let message = "";
    if (event.type === "message" && event.message.type === "text") message = event.message.text.trim();
    else if (event.type === "postback" && event.postback.data) message = event.postback.data.trim();
    else
      return client.replyMessage(replyToken, [
        { type: "text", text: "形式が不正です。ボタンで回答してください🙏" },
      ]);

    // 開始トリガー
    if (message === "ととのい度チェック開始") {
      const userRecord = await supabaseMemoryManager.getUser(lineId);
      if (!userRecord || (!userRecord.subscribed && !userRecord.trial_intro_done))
        return client.replyMessage(replyToken, [
          {
            type: "text",
            text: "この機能はご契約/お試し中の方限定です🙏\nメニュー内「サービス案内」から登録できます✨",
          },
        ]);

      userSession[lineId] = { step: 1, answers: {}, partialAnswers: {} };
      const context = await supabaseMemoryManager.getContext(lineId);
      return client.replyMessage(replyToken, [buildFlexMessage(questionSets[0], context)]);
    }

    // 未セッション
    if (!userSession[lineId])
      return client.replyMessage(replyToken, [
        { type: "text", text: '始めるには「ととのい度チェック開始」を押してください😊' },
      ]);

    const session = userSession[lineId];
    const question = questionSets[session.step - 1];

    // === 全問マルチ ===
    const parts = message.split(":");
    if (parts.length !== 2)
      return client.replyMessage(replyToken, [
        { type: "text", text: "ボタンから選んで送信してください🙏" },
      ]);

    const [key, answer] = parts;
    const validKey = question.options.find((opt) => opt.id === key);
    if (!validKey)
      return client.replyMessage(replyToken, [
        { type: "text", text: "その選択肢は使えません。ボタンから選んでください🙏" },
      ]);

    session.partialAnswers[key] = answer;
    const remaining = question.options
      .map((o) => o.id)
      .filter((k) => !(k in session.partialAnswers));

    if (remaining.length === 0) {
      Object.assign(session.answers, session.partialAnswers);
      session.partialAnswers = {};
      session.step++;
    } else return; // 同一Q内で継続

    // === 全完了 ===
    if (session.step > questionSets.length) {
      const answers = session.answers;
      await supabaseMemoryManager.setFollowupAnswers(lineId, answers);
      await client.replyMessage(replyToken, {
        type: "text",
        text: "✅ チェック完了！\n今週のケアプランをまとめてるよ🧠🌿",
      });

      handleFollowupAnswers(lineId, answers)
        .then(async (result) => {
          if (result?.sections) {
            const bubbles = buildResultFlexBubbles(result.sections);
            await client.pushMessage(lineId, {
              type: "flex",
              altText: "ととのい度チェック結果",
              contents: { type: "carousel", contents: bubbles },
            });
          } else {
            await client.pushMessage(lineId, {
              type: "text",
              text:
                "📋 今回のととのい度チェック\n\n" +
                (result?.gptComment || "解析コメントを生成できませんでした🙏"),
            });
          }
          delete userSession[lineId];
        })
        .catch(async (err) => {
          console.error("❌ GPTコメント生成失敗:", err);
          await client.pushMessage(lineId, {
            type: "text",
            text: "今週のケアプラン作成でエラーが出ました🙇\nしばらく時間をおいて再試行してください。",
          });
          delete userSession[lineId];
        });
      return;
    }

    // === 次の質問 ===
    const nextQuestion = questionSets[session.step - 1];
    const context = await supabaseMemoryManager.getContext(lineId);
    const nextFlex = buildFlexMessage(nextQuestion, context);
    return client.replyMessage(replyToken, nextFlex);
  } catch (err) {
    console.error("❌ followup/index.js エラー:", err);
    return client.replyMessage(replyToken, {
      type: "text",
      text: "エラーが発生しました。時間をおいて再試行してください🙏",
    });
  }
}

module.exports = Object.assign(handleFollowup, {
  hasSession: (lineId) => !!userSession[lineId],
});
