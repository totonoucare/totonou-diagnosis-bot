// followup/index.js
// ===============================================
// 「ととのい度チェック」週次チェックフロー（最終仕様）
// Q1: 主訴ふくむ体調 / Q2: 生活リズム / Q3: 動作テスト
// - 全て isMulti=true 形式
// - 回答完了後、トトノウくんGPTで2枚カード(JSON)生成
// - pushはカルーセル(2バブル: 状態まとめ＋ケアプラン)
// ===============================================

// ======== プレーンテキスト → sections 変換（堅牢版） ========
function parseFollowupTextToSections(text = "") {
  const sec = { card1: { score_block: { action: {}, effect: {} } }, card2: { care_plan: [] } };

  const b1 = text.match(/\[CARD1\]([\s\S]*?)\[\/CARD1\]/);
  const b2 = text.match(/\[CARD2\]([\s\S]*?)\[\/CARD2\]/);

  if (b1) {
    const s1 = b1[1];

    const lead     = (s1.match(/^\s*LEAD:\s*(.+)$/m) || [])[1];
    const guidance = (s1.match(/^\s*GUIDANCE:\s*(.+)$/m) || [])[1];

    const aScoreRaw = (s1.match(/^\s*ACTION_SCORE:\s*([0-9]{1,3})(?:\s*点)?\s*$/m) || [])[1];
    const aDiff     = (s1.match(/^\s*ACTION_DIFF:\s*(.+)$/m) || [])[1];

    const ePctNum = (s1.match(/^\s*EFFECT_PERCENT:\s*([0-9]{1,3})\s*[%％]\s*$/m) || [])[1];
    const eStars  = (s1.match(/^\s*EFFECT_STARS:\s*([★☆]{1,5})\s*$/m) || [])[1];
    const eDiff   = (s1.match(/^\s*EFFECT_DIFF:\s*(.+)$/m) || [])[1];

    sec.card1.lead     = (lead || "").trim();
    sec.card1.guidance = (guidance || "").trim();

    sec.card1.score_block.action = {
      label: "今週のケア努力点",
      score_text: aScoreRaw ? `${String(aScoreRaw).trim()} 点` : undefined,
      diff_text: aDiff ? aDiff.trim() : undefined,
      explain: "どれだけ行動できたか",
    };

    sec.card1.score_block.effect = {
      label: "ケア効果の反映度合い",
      percent_text: ePctNum ? `${String(ePctNum).trim()}%` : undefined,
      stars: eStars ? eStars.trim() : undefined,
      diff_text: eDiff ? eDiff.trim() : undefined,
      explain: "努力がどれだけ体調に反映されたか",
    };
  }

  if (b2) {
    const s2 = b2[1];

    const lead   = (s2.match(/^\s*LEAD:\s*(.+)$/m) || [])[1];
    const footer = (s2.match(/^\s*FOOTER:\s*(.+)$/m) || [])[1];

    sec.card2.lead   = (lead || "").trim();
    sec.card2.footer = (footer || "").trim();

    // PLAN 行（PLAN: / PLAN1: / PLAN 1: すべて許容）
    const planLines = s2.match(/^\s*PLAN\s*\d*\s*:\s*(.+)$/gm) || [];
    planLines.slice(0, 3).forEach((ln, i) => {
      const line = (ln.match(/^\s*PLAN\s*\d*\s*:\s*(.+)$/) || [])[1] || "";

      // 区切りは半角バー "|" または全角バー "｜" を許容
      const pillar = (line.match(/pillar\s*=\s*([^|｜]+)[|｜]?/i) || [])[1]?.trim();
      const freq   = (line.match(/freq\s*=\s*([^|｜]+)[|｜]?/i)   || [])[1]?.trim();
      const reason = (line.match(/reason\s*=\s*([^|｜]+)[|｜]?/i) || [])[1]?.trim();
      const link   = (line.match(/link\s*=\s*(https?:\S+)/i)      || [])[1]?.trim();

      sec.card2.care_plan.push({
        pillar: pillar || `プラン${i + 1}`,
        priority: i + 1,
        recommended_frequency: freq || "目安",
        reason: reason || "",
        reference_link: link,
      });
    });
  }

  // マーカーが無い場合の最低限フォールバック
  if (!b1 && !b2) {
    const first = text.split(/\r?\n/).find(l => l.trim());
    sec.card1.lead = (first || "おつかれさまでした😊").trim();
    sec.card1.guidance = "今日からのケアを続けていきましょう🌿";
    sec.card1.score_block.action = { label: "今週のケア努力点" };
    sec.card1.score_block.effect = { label: "ケア効果の反映度合い" };
    sec.card2.lead = "今週のフォーカス";
    sec.card2.care_plan = [];
    sec.card2.footer = "焦らず、今週もマイペースで🫶";
  }

  return sec;
}

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
  const scoreAction = card1.score_block?.action || {};
  const scoreEffect = card1.score_block?.effect || {};

  const scoreBlock = {
    type: "box",
    layout: "vertical",
    alignItems: "center",
    spacing: "sm",
    contents: [
      // 💪 ケア実施努力点
      {
        type: "text",
        text: `💪 ${scoreAction.label || "ケア実施努力点"}：${scoreAction.score_text || "--"}`,
        size: "lg",
        weight: "bold",
        color: "#C6A047",
        align: "center",
        wrap: false,
      },
      ...(scoreAction.diff_text
        ? [
            {
              type: "text",
              text: scoreAction.diff_text,
              size: "sm",
              color: "#888888",
              align: "center",
              margin: "xs",
              wrap: false,
            },
          ]
        : []),

      // スペースをやや広く
      { type: "separator", margin: "lg" },

      // 💫 ケア効果反映度（ラベル）
      {
        type: "text",
        text: `💫 ${scoreEffect.label || "ケア効果の反映度"}：`,
        size: "lg",
        weight: "bold",
        color: "#C6A047",
        align: "center",
        wrap: false,
        margin: "sm",
      },

      // 効果スコア（% + 星）
      {
        type: "box",
        layout: "baseline",
        justifyContent: "center",
        spacing: "sm",
        contents: [
          ...(scoreEffect.percent_text
            ? [
                {
                  type: "text",
                  text: scoreEffect.percent_text,
                  size: "xl",
                  weight: "bold",
                  color: "#C6A047",
                  align: "center",
                },
              ]
            : []),
          {
            type: "text",
            text: scoreEffect.stars || "☆☆☆☆☆",
            size: "xl",
            weight: "bold",
            color: "#C6A047",
            align: "center",
          },
        ],
      },
      ...(scoreEffect.diff_text
        ? [
            {
              type: "text",
              text: scoreEffect.diff_text,
              size: "sm",
              color: "#888888",
              align: "center",
              margin: "xs",
              wrap: false,
            },
          ]
        : []),
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
      paddingAll: "14px",
      cornerRadius: "12px",
    },
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#F8F9F7",
      paddingAll: "16px",
      spacing: "lg",
      contents: [
        scoreBlock,
        { type: "separator", margin: "xxl" }, // ← スコア後を広めに
        {
          type: "text",
          text: card1.lead || "おつかれさまでした😊",
          wrap: true,
          size: "md",
          color: "#333333",
          align: "start",
        },
        { type: "separator", margin: "xl" },
        {
          type: "text",
          text: card1.guidance || "今の流れを保っていこう🌿",
          wrap: true,
          size: "md",
          color: "#333333",
          align: "start",
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
        text: "✅ チェック完了！\nトトノウくんが今週の結果と今日からのケア指針をまとめています。\n１分ほどお待ちください🧠🌿",
      });

handleFollowupAnswers(lineId, answers)
  .then(async (result) => {
    let sections = result?.sections;

    // sections が無ければ、テキストから復元を試みる
    if (!sections && typeof result?.gptComment === "string" && result.gptComment.trim()) {
      try {
        sections = parseFollowupTextToSections(result.gptComment);
      } catch (e) {
        console.warn("⚠️ gptCommentのパース失敗:", e);
      }
    }

    if (sections) {
      const bubbles = buildResultFlexBubbles(sections);
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
