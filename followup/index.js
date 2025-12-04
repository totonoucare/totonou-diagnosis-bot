// followup/index.js
// ===============================================
// 「ととのい度チェック」週次チェックフロー（GPT不使用版）
// - Q1: 主訴ふくむ体調 / Q2: 生活リズム / Q3: 動作テスト
// - すべて isMulti=true 形式
// - 回答完了後：
//    ① 前回→今回のスコア変化をローカルで可視化（カード1）
//    ② ケア実施状況＋トトノウくんのひとこと（カード2）
//    ③ 下に「ケア効果の反映具合を聞く」ボタン付き CTA バブルを追加
// ===============================================

const questionSets = require("./questionSets");
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
    .replace(
      /\{\{symptom\}\}/g,
      symptomLabels[context.symptom] || "不明な主訴"
    )
    .replace(/\{\{motion\}\}/g, context.motion || "指定の動作");
}

// ======== 数値正規化ユーティリティ ========
function normalizeScore(v, def = null) {
  if (v === null || v === undefined || v === "") return def;
  const n = Number(v);
  if (Number.isNaN(n)) return def;
  return n;
}

function normalizeFollowupRow(row = {}) {
  return {
    symptom_level: normalizeScore(row.symptom, null),
    sleep: normalizeScore(row.sleep, null),
    meal: normalizeScore(row.meal, null),
    stress: normalizeScore(row.stress, null),
    motion_level: normalizeScore(row.motion_level, null),
  };
}

// ======== スコア差分 → 矢印＆コメント ========
// type: "main" | "general" | "motion"
function buildTrendInfo(prevVal, curVal, type = "general") {
  // prev が無い＝初回
  if (prevVal == null || curVal == null) {
    if (type === "main") {
      return {
        arrow: "－",
        comment: "今回が最初のチェックです",
      };
    }
    if (type === "motion") {
      return {
        arrow: "➖",
        comment: "今回が基準になります。ここから変化を見ていきましょう",
      };
    }
    return {
      arrow: "➖",
      comment: "今回が基準になります",
    };
  }

  const diff = prevVal - curVal; // 正なら「良くなった」
  let arrow = "➡️";
  let comment =
    type === "main"
      ? "前回と大きな変化はまだ少なめ"
      : type === "motion"
      ? "前回とあまり変わらず、土台をキープ中です"
      : "ほぼ横ばいです";

  // 改善側
  if (diff >= 2) {
    arrow = "⬆⬆✨";
    if (type === "main") {
      comment = "だいぶ楽になってきました";
    } else if (type === "motion") {
      comment = "体の土台がぐっと整いやすい状態になってきています";
    } else {
      comment = "かなり整ってきました";
    }
  } else if (diff >= 1) {
    arrow = "⬆";
    if (type === "main") {
      comment = "少し楽になってきました";
    } else if (type === "motion") {
      comment = "体の張りつめが少しゆるんできています";
    } else {
      comment = "少し整ってきています";
    }
  }

  // 悪化側
  if (diff <= -2) {
    arrow = "⬇⬇⚠️";
    if (type === "main") {
      comment = "前回よりツラさが強まりぎみです";
    } else if (type === "motion") {
      comment = "負担が強めに出ています。無理なく様子を見ていきましょう";
    } else {
      comment = "やや乱れが目立っています";
    }
  } else if (diff <= -1) {
    arrow = "⬇";
    if (type === "main") {
      comment = "少し負担が増えぎみです";
    } else if (type === "motion") {
      comment = "土台の負担が少し強まっていますが、よくある揺れの範囲です";
    } else {
      comment = "少し乱れが出ています";
    }
  }

  return { arrow, comment };
}

// ======== ケア実施状況 → 評価アイコン＆コメント ========
function evalCareRatio(days, totalDays) {
  const d = days || 0;
  const base = totalDays || 1;
  const ratio = d / base;

  if (ratio >= 0.8) {
    return { icon: "🟢 ◎", comment: "かなり意識できている状態です" };
  }
  if (ratio >= 0.6) {
    return { icon: "🟢 ○", comment: "しっかり続けられたペースです" };
  }
  if (ratio >= 0.4) {
    return { icon: "🟡 ○", comment: "半分くらい取り入れられています" };
  }
  if (ratio > 0) {
    return { icon: "🟡 △", comment: "ときどきできたくらいのペースです" };
  }
  return { icon: "🔴 ×", comment: "まだほとんど手をつけられていない状態です" };
}

// ======== Flex質問構築 ========
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

// ======== 結果バブル構築（2枚＋CTA） ========
function buildResultBubbles({
  context,
  prevScores,
  curScores,
  careCounts,
  effectiveDays,
}) {
  const symptomName =
    symptomLabels[context.symptom] || "全身のなんとなく不調";
  const motionName = context.motion || "指定の動作";

  // ---- トレンド情報 ----
  const mainTrend = buildTrendInfo(
    prevScores?.symptom_level,
    curScores.symptom_level,
    "main"
  );
  const sleepTrend = buildTrendInfo(prevScores?.sleep, curScores.sleep, "general");
  const mealTrend = buildTrendInfo(prevScores?.meal, curScores.meal, "general");
  const stressTrend = buildTrendInfo(
    prevScores?.stress,
    curScores.stress,
    "general"
  );
  const motionTrend = buildTrendInfo(
    prevScores?.motion_level,
    curScores.motion_level,
    "motion"
  );

  const prevSym = prevScores?.symptom_level ?? "➖";
  const curSym = curScores.symptom_level ?? "➖";

  // ---- カード1：体調＆構造の変化 ----
  const bubble1 = {
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
      spacing: "md",
      contents: [
        {
          type: "text",
          text: `🌡 全体のととのい度（「${symptomName}」を含む体調）`,
          weight: "bold",
          size: "md",
          wrap: true,
        },
        {
          type: "box",
          layout: "vertical",
          margin: "sm",
          contents: [
            {
              type: "text",
              text: `「${symptomName}」を含めた全体の体調`,
              size: "md",
              wrap: true,
            },
            {
              type: "text",
              text: `${prevSym} → ${curSym}　${mainTrend.arrow}　〔${mainTrend.comment}〕`,
              size: "md",
              margin: "xs",
              wrap: true,
            },
          ],
        },
        { type: "separator", margin: "md" },

        // 生活リズムブロック
        {
          type: "text",
          text: "🧩 ととのいを支える要素の変化（前回 → 今回）",
          weight: "bold",
          size: "md",
          wrap: true,
          margin: "md",
        },
        {
          type: "text",
          text: "🔹 生活リズムまわり",
          size: "sm",
          weight: "bold",
          margin: "sm",
        },
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: `🌙 睡眠リズム　${prevScores?.sleep ?? "-"} → ${
                curScores.sleep ?? "-"
              }　${sleepTrend.arrow}　〔${sleepTrend.comment}〕`,
              size: "md",
              wrap: true,
            },
            {
              type: "text",
              text: `🍽 食事のタイミング／量　${prevScores?.meal ?? "-"} → ${
                curScores.meal ?? "-"
              }　${mealTrend.arrow}　〔${mealTrend.comment}〕`,
              size: "md",
              wrap: true,
            },
            {
              type: "text",
              text: `😮‍💨 ストレス・気分の安定度　${
                prevScores?.stress ?? "-"
              } → ${curScores.stress ?? "-"}　${stressTrend.arrow}　〔${
                stressTrend.comment
              }〕`,
              size: "md",
              wrap: true,
            },
          ],
        },

        // 構造（動作テスト）
        {
          type: "text",
          text: "🔹 構造面のととのい（動作テスト）",
          size: "sm",
          weight: "bold",
          margin: "md",
        },
        {
          type: "text",
          text: `🧍‍♀️ 動作テスト（${motionName}）　${
            prevScores?.motion_level ?? "-"
          } → ${curScores.motion_level ?? "-"}　${motionTrend.arrow}　〔${
            motionTrend.comment
          }〕`,
          size: "md",
          wrap: true,
        },
      ],
    },
  };

  // ---- カード2：ケア実施状況 ＋ トトノウくんのひとこと ----

  // 優先ケア判定（context.advice 内の priority=1 を優先扱い）
  const adviceCards = Array.isArray(context.advice) ? context.advice : [];
  const priorityKeys = adviceCards
    .filter((c) => c.priority === 1 && c.key)
    .map((c) => c.key);

  const isPriority = (key) => priorityKeys.includes(key);

  const effDays = effectiveDays || 1;
  const careLinesPriority = [];
  const careLinesSupport = [];

  const pillars = [
    {
      key: "breathing",
      label: "🌬 呼吸法",
      count: careCounts.breathing ?? 0,
      adviceKey: "breathing",
    },
    {
      key: "stretch",
      label: "🤸‍♀️ 経絡ストレッチ",
      count: careCounts.stretch ?? 0,
      adviceKey: "stretch",
    },
    {
      key: "tsubo",
      label: "👉 指先・ツボほぐし",
      count: careCounts.tsubo ?? 0,
      adviceKey: "points",
    },
    {
      key: "habits",
      label: "🌱 体質改善習慣（生活リズム）",
      count: careCounts.habits ?? 0,
      adviceKey: "lifestyle",
    },
    {
      key: "kampo",
      label: "🌿 漢方・サプリ",
      count: careCounts.kampo ?? 0,
      adviceKey: "kanpo", // おまけ枠だが扱いは同じ。フィードバックは柔らかめに。
    },
  ];

  pillars.forEach((p) => {
    const evalInfo = evalCareRatio(p.count, effDays);
    const lineText = `・${p.label}\n${p.count}日 / ${effDays}日　${evalInfo.icon}〔${evalInfo.comment}〕`;

    if (isPriority(p.adviceKey) && p.key !== "kampo") {
      careLinesPriority.push(lineText);
    } else {
      // 優先ケアに含まれないもの＋漢方はサポート側に表示
      careLinesSupport.push(lineText);
    }
  });

  const priorityBlock =
    careLinesPriority.length > 0
      ? [
          {
            type: "text",
            text: "＜優先ケア＞",
            size: "sm",
            weight: "bold",
            margin: "md",
          },
          {
            type: "text",
            text: careLinesPriority.join("\n"),
            size: "md",
            wrap: true,
            margin: "xs",
          },
        ]
      : [];

  const supportBlock =
    careLinesSupport.length > 0
      ? [
          {
            type: "text",
            text: "＜サポートケア（＋おまけ枠：漢方・サプリ）＞",
            size: "sm",
            weight: "bold",
            margin: "md",
          },
          {
            type: "text",
            text: careLinesSupport.join("\n"),
            size: "md",
            wrap: true,
            margin: "xs",
          },
        ]
      : [];

  // 簡易フィードバック文（内部ロジック）
  const goodPillars = pillars.filter(
    (p) => p.count / effDays >= 0.6 && p.count > 0
  );
  const weakPillars = pillars.filter((p) => p.count / effDays < 0.3);

  let feedbackText = "今週もケアを続けてくれてありがとうございます。\n";

  if (goodPillars.length > 0) {
    const names = goodPillars
      .map((p) => p.label.replace(/^.+? /, ""))
      .join("・");
    feedbackText += `とくに「${names}」は、とても良いペースで積み重ねられています。\n`;
  }

  if (weakPillars.length > 0) {
    const names = weakPillars
      .map((p) => p.label.replace(/^.+? /, ""))
      .join("・");
    feedbackText += `一方で「${names}」は、まだ手をつけづらかった様子なので、体調がゆるす日だけでも「1日1回だけ」足してみると、動作テストや「${symptomName}」のラクさに少しずつ反映されやすくなります。\n`;
  }

  if (goodPillars.length === 0 && weakPillars.length === 0) {
    feedbackText +=
      "まだこれからペースを作っていく段階です。焦らず、「今日できそうなケア」をひとつだけ一緒に選んでいきましょう。";
  } else {
    feedbackText +=
      "あせらず、今できていることを土台にしながら、すこしずつ整えていきましょう🌿";
  }

  const bubble2 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "🪴 ケア実施状況とトトノウくんのひとこと",
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
      contents: [
        // 上：ケア実施状況
        {
          type: "text",
          text: "🧭 ケア実施状況（前回チェック〜今回）",
          size: "md",
          weight: "bold",
          wrap: true,
        },
        ...priorityBlock,
        ...supportBlock,
        { type: "separator", margin: "md" },
        // 下：一言フィードバック
        {
          type: "text",
          text: "💬 トトノウくんからのひとこと",
          size: "sm",
          weight: "bold",
          wrap: true,
          margin: "sm",
        },
        {
          type: "text",
          text: feedbackText,
          size: "md",
          wrap: true,
        },
      ],
    },
  };

  // ---- CTA バブル（ケア効果の反映具合を聞く） ----
  const ctaBubble = {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#FFFFFF",
      paddingAll: "16px",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: "🧠 ケア効果の反映具合をトトノウくんに聞く",
          weight: "bold",
          size: "md",
          wrap: true,
        },
        {
          type: "text",
          text:
            "「このケアがどのくらい体調に反映されてそうか知りたいな…」と感じたときは、下のボタンからAIチャットでトトノウくんに相談できます。",
          size: "md",
          wrap: true,
        },
        {
          type: "button",
          style: "primary",
          color: "#7B9E76",
          action: {
            type: "message",
            label: "ケア効果の反映具合を聞く",
            text: "ケア効果の反映具合を聞く",
          },
        },
      ],
    },
  };

  return { bubbles: [bubble1, bubble2], ctaBubble };
}

// ======== メイン処理 ========
async function handleFollowup(event, client, lineId) {
  const replyToken = event.replyToken;
  try {
    let message = "";
    if (event.type === "message" && event.message.type === "text") {
      message = event.message.text.trim();
    } else if (event.type === "postback" && event.postback.data) {
      message = event.postback.data.trim();
    } else {
      return client.replyMessage(replyToken, [
        { type: "text", text: "形式が不正です。ボタンで回答してください🙏" },
      ]);
    }

    // 開始トリガー
    if (message === "ととのい度チェック開始") {
      const userRecord = await supabaseMemoryManager.getUser(lineId);
      if (!userRecord || (!userRecord.subscribed && !userRecord.trial_intro_done)) {
        return client.replyMessage(replyToken, [
          {
            type: "text",
            text:
              "この機能はご契約/お試し中の方限定です🙏\nメニュー内「サービス案内」から登録できます✨",
          },
        ]);
      }

      userSession[lineId] = { step: 1, answers: {}, partialAnswers: {} };
      const context = await supabaseMemoryManager.getContext(lineId);
      return client.replyMessage(replyToken, [
        buildFlexMessage(questionSets[0], context),
      ]);
    }

    // 未セッション
    if (!userSession[lineId]) {
      return client.replyMessage(replyToken, [
        { type: "text", text: '始めるには「ととのい度チェック開始」を押してください😊' },
      ]);
    }

    const session = userSession[lineId];
    const question = questionSets[session.step - 1];

    // === 全問マルチ ===
    const parts = message.split(":");
    if (parts.length !== 2) {
      return client.replyMessage(replyToken, [
        { type: "text", text: "ボタンから選んで送信してください🙏" },
      ]);
    }

    const [key, answer] = parts;
    const validKey = question.options.find((opt) => opt.id === key);
    if (!validKey) {
      return client.replyMessage(replyToken, [
        { type: "text", text: "その選択肢は使えません。ボタンから選んでください🙏" },
      ]);
    }

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

    // === 全完了 ===
    if (session.step > questionSets.length) {
      const answers = session.answers;

      // 1. Supabaseへ保存（従来どおり）
      await supabaseMemoryManager.setFollowupAnswers(lineId, answers);

      // 2. context + 前回スコア + carelogs を取得
      const context = await supabaseMemoryManager.getContext(lineId);
      const userRecord = await supabaseMemoryManager.getUser(lineId);
      if (!context || !userRecord) {
        delete userSession[lineId];
        return client.replyMessage(replyToken, [
          {
            type: "text",
            text:
              "分析データが見つかりませんでした。体質分析から始めてみてください🙏",
          },
        ]);
      }

      const { latest, prev } =
        await supabaseMemoryManager.getLastTwoFollowupsByUserId(userRecord.id);

const curScores = {
  symptom_level: normalizeScore(
    answers.symptom ?? latest?.symptom_level,
    null
  ),
  sleep: normalizeScore(answers.sleep ?? latest?.sleep, null),
  meal: normalizeScore(answers.meal ?? latest?.meal, null),
  stress: normalizeScore(answers.stress ?? latest?.stress, null),
  motion_level: normalizeScore(
    answers.motion_level ?? latest?.motion_level,
    null
  ),
};

const prevScores = prev ? normalizeFollowupRow(prev) : null;

      // ケア実施日数（前回チェック〜今回）
      let careCounts = {};
      try {
        const raw =
          await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(
            lineId
          );
        careCounts = {
          habits: raw.habits ?? 0,
          breathing: raw.breathing ?? 0,
          stretch: raw.stretch ?? 0,
          tsubo: raw.tsubo ?? 0,
          kampo: raw.kampo ?? 0,
        };
      } catch (e) {
        console.warn("⚠️ care_logs_daily 取得失敗:", e.message);
        careCounts = {
          habits: 0,
          breathing: 0,
          stretch: 0,
          tsubo: 0,
          kampo: 0,
        };
      }

      // 評価対象日数（前回〜今回 or context開始〜今回）
      const now = Date.now();
      const prevDate = prev?.created_at
        ? new Date(prev.created_at).getTime()
        : null;
      const contextDate = context?.created_at
        ? new Date(context.created_at).getTime()
        : null;

      const diffDays = prevDate
        ? Math.ceil((now - prevDate) / (1000 * 60 * 60 * 24))
        : contextDate
        ? Math.ceil((now - contextDate) / (1000 * 60 * 60 * 24))
        : 1;
      const effectiveDays = Math.max(1, diffDays);

      const { bubbles, ctaBubble } = buildResultBubbles({
        context,
        prevScores,
        curScores,
        careCounts,
        effectiveDays,
      });

      delete userSession[lineId];

      const carouselFlex = {
        type: "flex",
        altText: "ととのい度チェック結果",
        contents: {
          type: "carousel",
          contents: bubbles,
        },
      };

      const ctaFlex = {
        type: "flex",
        altText: "ケア効果をトトノウくんに聞く",
        contents: ctaBubble,
      };

      return client.replyMessage(replyToken, [carouselFlex, ctaFlex]);
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
