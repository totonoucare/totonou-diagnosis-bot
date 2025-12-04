// followup/index.js
// ===============================================
// 「ととのい度チェック」週次チェックフロー（新仕様）
// Q1: 主訴ふくむ体調 / Q2: 生活リズム / Q3: 動作テスト
// - 全て isMulti=true 形式
// - 回答完了後：
//   ・カード1：数値とケアログを使った“事実のダッシュボード”（非GPT）
//   ・カード2：トトノウくんGPTによる今週のフォーカス＆ケアプラン
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

/* ---------------------------
   🧩 GPT用：マークアップ → sections 変換
   （CARD2 だけ使うが、既存フォーマットとの互換維持のため残す）
--------------------------- */
function parseFollowupTextToSections(text = "") {
  const sec = { card1: { score_block: { action: {}, effect: {} } }, card2: { care_plan: [] } };

  const b1 = text.match(/\[CARD1\]([\s\S]*?)\[\/CARD1\]/);
  const b2 = text.match(/\[CARD2\]([\s\S]*?)\[\/CARD2\]/);

  if (b1) {
    const s1 = b1[1];

    const lead = (s1.match(/^\s*LEAD:\s*(.+)$/m) || [])[1];
    const guidance = (s1.match(/^\s*GUIDANCE:\s*(.+)$/m) || [])[1];

    const aScoreRaw = (s1.match(/^\s*ACTION_SCORE:\s*([0-9]{1,3})(?:\s*点)?\s*$/m) || [])[1];
    const aDiff = (s1.match(/^\s*ACTION_DIFF:\s*(.+)$/m) || [])[1];

    const ePctNum = (s1.match(/^\s*EFFECT_PERCENT:\s*([0-9]{1,3})\s*[%％]\s*$/m) || [])[1];
    const eStars = (s1.match(/^\s*EFFECT_STARS:\s*([★☆]{1,5})\s*$/m) || [])[1];
    const eDiff = (s1.match(/^\s*EFFECT_DIFF:\s*(.+)$/m) || [])[1];

    sec.card1.lead = (lead || "").trim();
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

    const lead = (s2.match(/^\s*LEAD:\s*(.+)$/m) || [])[1];
    const footer = (s2.match(/^\s*FOOTER:\s*(.+)$/m) || [])[1];

    sec.card2.lead = (lead || "").trim();
    sec.card2.footer = (footer || "").trim();

    // PLAN 行（PLAN: / PLAN1: / PLAN 1: すべて許容）
    const planLines = s2.match(/^\s*PLAN\s*\d*\s*:\s*(.+)$/gm) || [];
    planLines.slice(0, 3).forEach((ln, i) => {
      const line = (ln.match(/^\s*PLAN\s*\d*\s*:\s*(.+)$/) || [])[1] || "";

      const pillar = (line.match(/pillar\s*=\s*([^|｜]+)[|｜]?/i) || [])[1]?.trim();
      const freq = (line.match(/freq\s*=\s*([^|｜]+)[|｜]?/i) || [])[1]?.trim();
      const reason = (line.match(/reason\s*=\s*([^|｜]+)[|｜]?/i) || [])[1]?.trim();
      const link = (line.match(/link\s*=\s*(https?:\S+)/i) || [])[1]?.trim();

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
    const first = text.split(/\r?\n/).find((l) => l.trim());
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

/* ---------------------------
   🧮 差分→矢印＆コメント生成ヘルパー
--------------------------- */

/**
 * 5段階スコアの差分から矢印・コメントを生成
 * @param {number|null} prev
 * @param {number|null} cur
 * @param {"symptom"|"sleep"|"meal"|"stress"|"motion"} kind
 */
function buildDeltaLabel(prev, cur, kind) {
  if (!cur && cur !== 0 && !prev && prev !== 0) {
    return { line: "データなし", note: "まだ比較できるデータがありません" };
  }

  const prevText = prev != null ? String(prev) : "-";
  const curText = cur != null ? String(cur) : "-";

  if (prev == null) {
    return {
      line: `${prevText} → ${curText}　📍`,
      note: "今回が初回のチェックです。ここから変化を見ていきましょう。",
    };
  }

  const diff = prev - cur; // 改善 → プラス

  let arrow = "→";
  let note = "ほぼ変化はありません。";

  // 種別ごとにコメントを変える
  const labelSet = {
    symptom: {
      bigUp: "だいぶ楽になってきました",
      smallUp: "少し楽になってきました",
      flat: "大きな変化はありませんが、様子を見ていきましょう",
      smallDown: "少しつらさが出やすくなっています",
      bigDown: "やや負担が強まっているかもしれません",
    },
    sleep: {
      bigUp: "かなり整ってきました",
      smallUp: "少し整ってきました",
      flat: "大きな乱れはありません",
      smallDown: "少し乱れが気になる状態です",
      bigDown: "睡眠の乱れが強めに出ています",
    },
    meal: {
      bigUp: "かなり良いリズムが続いています",
      smallUp: "少し整ってきています",
      flat: "大きな変化はありません",
      smallDown: "ちょっと不規則ぎみです",
      bigDown: "食事リズムの乱れが目立っています",
    },
    stress: {
      bigUp: "心身ともにだいぶ落ち着きやすくなっています",
      smallUp: "前より落ち着きやすくなっています",
      flat: "ストレス状態は大きく変わっていません",
      smallDown: "少し気を張りやすい状態です",
      bigDown: "負担がかなりかかっているかもしれません",
    },
    motion: {
      bigUp: "動きやすさがはっきり変わってきています",
      smallUp: "少し動きやすくなってきています",
      flat: "固さはまだ残っています",
      smallDown: "少し動かしにくさが増えています",
      bigDown: "負担がかなり強く出ている状態です",
    },
  }[kind || "symptom"];

  if (diff >= 2) {
    arrow = "⬆⬆✨";
    note = labelSet.bigUp;
  } else if (diff === 1) {
    arrow = "⬆";
    note = labelSet.smallUp;
  } else if (diff === 0) {
    arrow = "→";
    note = labelSet.flat;
  } else if (diff === -1) {
    arrow = "⬇";
    note = labelSet.smallDown;
  } else if (diff <= -2) {
    arrow = "⬇⬇";
    note = labelSet.bigDown;
  }

  return {
    line: `${prevText} → ${curText}　${arrow}`,
    note: `〔${note}〕`,
  };
}

/* ---------------------------
   🧮 ケア実施状況 → 記号・コメント
--------------------------- */

/**
 * 実施日数 / 期間日数 から、評価記号とコメントを生成
 */
function evalCareExecution(days, periodDays) {
  const totalDays = Math.max(1, periodDays || 1);
  const d = Math.max(0, days || 0);
  const ratio = d / totalDays;

  if (d === 0) {
    return {
      mark: "🔴 ×",
      comment: "〔ほとんどできていない状態〕",
    };
  }

  if (ratio <= 0.2) {
    return {
      mark: "🔴 ×",
      comment: "〔ほとんどできていない状態〕",
    };
  }

  if (ratio <= 0.4) {
    return {
      mark: "🟡 △",
      comment: "〔ときどきできたくらい〕",
    };
  }

  if (ratio < 0.7) {
    return {
      mark: "🟡 ○",
      comment: "〔半分くらい取り入れられた〕",
    };
  }

  return {
    mark: "🟢 ◎",
    comment: "〔しっかり続けられたペース〕",
  };
}

/**
 * context.advice から、優先ケア vs サポートケアを判定
 * adviceCards: [{ key, priority, ... }]
 */
function splitCarePriority(contextAdvice = []) {
  const adviceArray = Array.isArray(contextAdvice) ? contextAdvice : [];
  const priorityKeys = new Set(
    adviceArray.filter((a) => a && a.priority === 1 && a.key).map((a) => a.key)
  );

  // key -> careLog上のキー
  const keyMap = {
    lifestyle: "habits",
    breathing: "breathing",
    stretch: "stretch",
    points: "tsubo",
    kanpo: "kampo",
  };

  const labelMap = {
    habits: "🌱 体質改善習慣（生活リズム）",
    breathing: "🌬 呼吸法",
    stretch: "🤸‍♀️ 経絡ストレッチ",
    tsubo: "👉 指先・ツボほぐし",
    kampo: "🌿 漢方・サプリ",
  };

  const allCareKeys = ["habits", "breathing", "stretch", "tsubo", "kampo"];

  const priority = [];
  const support = [];

  for (const careKey of allCareKeys) {
    const adviceKey =
      Object.entries(keyMap).find(([, v]) => v === careKey)?.[0] || null;
    const isPriority = adviceKey && priorityKeys.has(adviceKey);

    const targetList = isPriority ? priority : support;
    targetList.push({
      careKey,
      label: labelMap[careKey],
    });
  }

  return { priority, support };
}

/* ---------------------------
   🧱 カード1：ダッシュボードバブル生成
--------------------------- */

/**
 * カード1（非GPT）の Flex Bubble を生成
 * @param {Object} params
 *  - context: getContext(lineId) の結果
 *  - latest:  最新のfollowup
 *  - prev:    1つ前のfollowup（なければnull）
 *  - careCounts: {habits,breathing,stretch,tsubo,kampo} 期間内実施日数
 *  - periodDays: 前回チェック〜今回までの日数
 */
function buildDashboardBubble({ context, latest, prev, careCounts, periodDays }) {
  const symptomCode = context?.symptom || "unknown";
  const symptomName = symptomLabels[symptomCode] || "からだの状態";
  const motionName = context?.motion || "指定の動作";

  // 体調スコア
  const cur = latest || {};
  const prevF = prev || {};

  const mainDelta = buildDeltaLabel(
    prevF.symptom_level,
    cur.symptom_level,
    "symptom"
  );

  const sleepDelta = buildDeltaLabel(prevF.sleep, cur.sleep, "sleep");
  const mealDelta = buildDeltaLabel(prevF.meal, cur.meal, "meal");
  const stressDelta = buildDeltaLabel(prevF.stress, cur.stress, "stress");
  const motionDelta = buildDeltaLabel(
    prevF.motion_level,
    cur.motion_level,
    "motion"
  );

  // ケア実施状況
  const totalDays = Math.max(1, periodDays || 7);
  const counts = {
    habits: careCounts?.habits || 0,
    breathing: careCounts?.breathing || 0,
    stretch: careCounts?.stretch || 0,
    tsubo: careCounts?.tsubo || 0,
    kampo: careCounts?.kampo || 0,
  };

  const { priority, support } = splitCarePriority(context?.advice);

  const makeCareLine = (careKey) => {
    const days = counts[careKey] || 0;
    const evalRes = evalCareExecution(days, totalDays);
    const labelMap = {
      habits: "🌱 体質改善習慣（生活リズム）",
      breathing: "🌬 呼吸法",
      stretch: "🤸‍♀️ 経絡ストレッチ",
      tsubo: "👉 指先・ツボほぐし",
      kampo: "🌿 漢方・サプリ",
    };
    return {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        {
          type: "text",
          text: labelMap[careKey],
          size: "sm",
          wrap: true,
        },
        {
          type: "text",
          text: `${days}日 / ${totalDays}日　${evalRes.mark} ${evalRes.comment}`,
          size: "xs",
          color: "#555555",
          wrap: true,
        },
      ],
    };
  };

  const priorityBoxes =
    priority.length > 0
      ? priority.map((p) => makeCareLine(p.careKey))
      : [
          {
            type: "text",
            text: "設定された優先ケアはありません。",
            size: "xs",
            color: "#777777",
            wrap: true,
          },
        ];

  const supportBoxes =
    support.length > 0
      ? support.map((p) => makeCareLine(p.careKey))
      : [
          {
            type: "text",
            text: "設定されたサポートケアはありません。",
            size: "xs",
            color: "#777777",
            wrap: true,
          },
        ];

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "📊 今週のととのいチェック結果",
          weight: "bold",
          size: "lg",
          color: "#FFFFFF",
          wrap: true,
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
      spacing: "md",
      contents: [
        // 🌡 全体のととのい度
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: `🌡 全体のととのい度（「${symptomName}」を含む体調）`,
              weight: "bold",
              size: "sm",
              wrap: true,
              color: "#333333",
            },
            {
              type: "text",
              text: `「${symptomName}」を含めた全体の体調`,
              size: "xs",
              color: "#555555",
              wrap: true,
            },
            {
              type: "text",
              text: `${mainDelta.line}　${mainDelta.note}`,
              size: "xs",
              color: "#333333",
              wrap: true,
              margin: "xs",
            },
          ],
        },

        { type: "separator", margin: "md" },

        // 🧩 ととのいを支える要素
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: "🧩 ととのいを支える要素の変化（前回 → 今回）",
              weight: "bold",
              size: "sm",
              wrap: true,
            },
            {
              type: "text",
              text: "🔹 生活リズムまわり",
              size: "xs",
              weight: "bold",
              margin: "sm",
            },
            // 睡眠
            {
              type: "box",
              layout: "vertical",
              margin: "xs",
              contents: [
                {
                  type: "text",
                  text: "• 🌙 睡眠リズム",
                  size: "xs",
                  wrap: true,
                },
                {
                  type: "text",
                  text: `${sleepDelta.line}　${sleepDelta.note}`,
                  size: "xs",
                  color: "#555555",
                  wrap: true,
                },
              ],
            },
            // 食事
            {
              type: "box",
              layout: "vertical",
              margin: "xs",
              contents: [
                {
                  type: "text",
                  text: "• 🍽 食事のタイミング／量",
                  size: "xs",
                  wrap: true,
                },
                {
                  type: "text",
                  text: `${mealDelta.line}　${mealDelta.note}`,
                  size: "xs",
                  color: "#555555",
                  wrap: true,
                },
              ],
            },
            // ストレス
            {
              type: "box",
              layout: "vertical",
              margin: "xs",
              contents: [
                {
                  type: "text",
                  text: "• 😮‍💨 ストレス・気分の安定度",
                  size: "xs",
                  wrap: true,
                },
                {
                  type: "text",
                  text: `${stressDelta.line}　${stressDelta.note}`,
                  size: "xs",
                  color: "#555555",
                  wrap: true,
                },
              ],
            },

            // 動作テスト
            {
              type: "text",
              text: "🔹 構造面のととのい（動作テスト）",
              size: "xs",
              weight: "bold",
              margin: "md",
            },
            {
              type: "box",
              layout: "vertical",
              margin: "xs",
              contents: [
                {
                  type: "text",
                  text: `• 🧍‍♀️ 動作テスト（${motionName}）`,
                  size: "xs",
                  wrap: true,
                },
                {
                  type: "text",
                  text: `${motionDelta.line}　${motionDelta.note}`,
                  size: "xs",
                  color: "#555555",
                  wrap: true,
                },
              ],
            },
          ],
        },

        { type: "separator", margin: "md" },

        // 🧭 ケア実施状況
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: "🧭 ケア実施状況（前回チェック〜今回）",
              weight: "bold",
              size: "sm",
              wrap: true,
            },
            {
              type: "text",
              text: "＜優先ケア＞",
              size: "xs",
              weight: "bold",
              margin: "sm",
            },
            ...priorityBoxes,
            {
              type: "text",
              text: "＜サポートケア＞",
              size: "xs",
              weight: "bold",
              margin: "sm",
            },
            ...supportBoxes,
          ],
        },
      ],
    },
  };
}

/* ---------------------------
   🧱 カード2：GPTフィードバック → Flex変換
   （優先順位・頻度は表示しない版）
--------------------------- */

function buildCarePlanBubbleFromSections(card2 = {}) {
  const carePlanList = Array.isArray(card2.care_plan) ? card2.care_plan : [];

  const contents = [];

  // リード文
  contents.push({
    type: "text",
    text: card2.lead || "今回のケアのがんばりが、体調にどう反映されていそうかをまとめました🌿",
    wrap: true,
    size: "md",
    margin: "none",
  });

  // フィードバック箇条書き（PLANの reason だけ使う）
  carePlanList.forEach((p) => {
    if (!p || !p.reason) return;

    // pillar はあくまで「どのケアについての話か」を軽く添える程度にする（優先順位ではない）
    const pill = (p.pillar || "").trim();
    const titleText = pill
      ? `• ${pill}についてのフィードバック`
      : "• ケアの取り組みについて";

    contents.push({
      type: "box",
      layout: "vertical",
      margin: "sm",
      contents: [
        {
          type: "text",
          text: titleText,
          size: "xs",
          weight: "bold",
          wrap: true,
        },
        {
          type: "text",
          text: p.reason,
          size: "xs",
          color: "#555555",
          wrap: true,
          margin: "xs",
        },
      ],
    });
  });

  // PLAN がゼロだった場合のフォールバック
  if (carePlanList.length === 0) {
    contents.push({
      type: "text",
      text: "今回のチェックでは、具体的なフィードバック文が生成できませんでした🙏\nおおまかな体調の流れだけ参考にしてみてください。",
      wrap: true,
      size: "xs",
      color: "#777777",
      margin: "md",
    });
  }

  contents.push({ type: "separator", margin: "md" });

  // フッター
  contents.push({
    type: "text",
    text:
      card2.footer ||
      "うまくいったこと・続けられたことを土台にしながら、今週もマイペースでいきましょう🫶",
    wrap: true,
    size: "xs",
    color: "#888888",
  });

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "🪴 今回のケアフィードバック",
          weight: "bold",
          size: "lg",
          color: "#ffffff",
        },
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
      contents,
    },
  };
}

/* ---------------------------
   📦 Flex質問構築
--------------------------- */

function buildFlexMessage(question, context = {}) {
  return buildMultiQuestionFlex({
    altText: replacePlaceholders(question.header, context),
    header: replacePlaceholders(question.header, context),
    body: replacePlaceholders(question.body, context),
    questions: question.options.map((opt) => ({
      key: opt.id,
      title: replacePlaceholders(
        multiLabels[opt.id] || opt.label || opt.id,
        context
      ),
      items: opt.items,
    })),
  });
}

/* ---------------------------
   🎛 メイン処理
--------------------------- */

async function handleFollowup(event, client, lineId) {
  const replyToken = event.replyToken;

  try {
    let message = "";
    if (event.type === "message" && event.message.type === "text")
      message = event.message.text.trim();
    else if (event.type === "postback" && event.postback.data)
      message = event.postback.data.trim();
    else
      return client.replyMessage(replyToken, [
        { type: "text", text: "形式が不正です。ボタンで回答してください🙏" },
      ]);

    // 🔰 開始トリガー
    if (message === "ととのい度チェック開始") {
      const userRecord = await supabaseMemoryManager.getUser(lineId);
      if (
        !userRecord ||
        (!userRecord.subscribed && !userRecord.trial_intro_done)
      )
        return client.replyMessage(replyToken, [
          {
            type: "text",
            text:
              "この機能はご契約/お試し中の方限定です🙏\nメニュー内「サービス案内」から登録できます✨",
          },
        ]);

      userSession[lineId] = {
        step: 1,
        answers: {},
        partialAnswers: {},
      };
      const context = await supabaseMemoryManager.getContext(lineId);
      return client.replyMessage(replyToken, [
        buildFlexMessage(questionSets[0], context),
      ]);
    }

    // セッション未開始
    if (!userSession[lineId])
      return client.replyMessage(replyToken, [
        {
          type: "text",
          text: '始めるには「ととのい度チェック開始」を押してください😊',
        },
      ]);

    const session = userSession[lineId];
    const question = questionSets[session.step - 1];

    // === 全問マルチ形式 ===
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
    } else {
      // 同一Q内で継続
      return;
    }

    // === 全ての質問が完了 ===
    if (session.step > questionSets.length) {
      const answers = session.answers;

      // ここでは setFollowupAnswers は呼ばず、
      // followupRouter 内の保存ロジックに任せる
      await client.replyMessage(replyToken, {
        type: "text",
        text:
          "✅ チェック完了！\nトトノウくんが今週の結果と今日からのケア指針をまとめています。\n少しだけお待ちください🧠🌿",
      });

      handleFollowupAnswers(lineId, answers)
        .then(async (result) => {
          // context & userId 取得
          const context = await supabaseMemoryManager.getContext(lineId);
          const userRecord = await supabaseMemoryManager.getUser(lineId);
          const userId = userRecord?.id;

          // 最新 & 前回 followup
          let latest = null;
          let prev = null;
          let periodDays = 7; // デフォルト

          if (userId) {
            const lastTwo =
              await supabaseMemoryManager.getLastTwoFollowupsByUserId(userId);
            latest = lastTwo?.latest || null;
            prev = lastTwo?.prev || null;

            const msPerDay = 1000 * 60 * 60 * 24;
            if (latest && prev) {
              const diffMs =
                new Date(latest.created_at).getTime() -
                new Date(prev.created_at).getTime();
              periodDays = Math.max(1, Math.round(diffMs / msPerDay));
            } else if (latest && context?.created_at) {
              const diffMs =
                new Date(latest.created_at).getTime() -
                new Date(context.created_at).getTime();
              periodDays = Math.max(1, Math.round(diffMs / msPerDay));
            }
          }

          const careCounts =
            result?.carelogSummary || {
              habits: 0,
              breathing: 0,
              stretch: 0,
              tsubo: 0,
              kampo: 0,
            };

          // 🟩 カード1（ダッシュボード）
          const dashboardBubble = buildDashboardBubble({
            context,
            latest,
            prev,
            careCounts,
            periodDays,
          });

          // 🟨 カード2（GPTケアプラン）
          let sections = result?.sections;
          if (
            !sections &&
            typeof result?.gptComment === "string" &&
            result.gptComment.trim()
          ) {
            try {
              sections = parseFollowupTextToSections(result.gptComment);
            } catch (e) {
              console.warn("⚠️ gptCommentのパース失敗:", e);
            }
          }

          const bubbles = [dashboardBubble];

          if (sections && sections.card2) {
            const card2Bubble = buildCarePlanBubbleFromSections(sections.card2);
            bubbles.push(card2Bubble);
          } else if (result?.gptComment) {
            // フォールバック：テキストのみ
            bubbles.push({
              type: "bubble",
              body: {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "text",
                    text: "今週のケアプラン",
                    weight: "bold",
                    size: "lg",
                    margin: "md",
                  },
                  {
                    type: "text",
                    text: result.gptComment,
                    wrap: true,
                    size: "sm",
                    margin: "md",
                  },
                ],
              },
            });
          }

          await client.pushMessage(lineId, {
            type: "flex",
            altText: "ととのい度チェック結果",
            contents: { type: "carousel", contents: bubbles },
          });

          delete userSession[lineId];
        })
        .catch(async (err) => {
          console.error("❌ GPTコメント生成失敗:", err);
          await client.pushMessage(lineId, {
            type: "text",
            text:
              "今週のケアプラン作成でエラーが出ました🙇\nしばらく時間をおいて再試行してください。",
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
