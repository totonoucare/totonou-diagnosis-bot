// followup/index.js
// ===============================================
// 「ととのい度チェック」週次チェックフロー（GPT不使用版）
// - Q1: 主訴ふくむ体調 / Q2: 生活リズム / Q3: 負荷チェック（動作）
// - すべて isMulti=true 形式
// - 回答完了後：
//    ① 前回→今回のスコア変化をローカルで可視化（カード1）
//    ② ケア実施状況をゲージで可視化（カード2）
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
  sleep: "睡眠リズム",
  meal: "食事のタイミング/量",
  stress: "ストレス・気分の安定度",
  motion_level: "「{{motion}}」のつらさ",
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
    .replace(/\{\{motion\}\}/g, context.motion || "指定の動き");
}

// ======== 数値正規化ユーティリティ ========
function normalizeScore(v, def = null) {
  if (v === null || v === undefined || v === "") return def;
  const n = Number(v);
  if (Number.isNaN(n)) return def;
  return n;
}

function normalizeFollowupRow(row = {}) {
  // 古いデータで symptom カラム名だった場合も拾う
  return {
    symptom_level: normalizeScore(
      row.symptom_level ?? row.symptom,
      null
    ),
    sleep: normalizeScore(row.sleep, null),
    meal: normalizeScore(row.meal, null),
    stress: normalizeScore(row.stress, null),
    motion_level: normalizeScore(row.motion_level, null),
  };
}

// ======== スコア → ととのい★ゲージ ========
// 1〜5（数字が小さいほどラク）を「整い度」★5段階に反転
function scoreToStars(score) {
  const n = normalizeScore(score, null);
  if (n == null) return "－－－－－"; // データなし
  const clamped = Math.min(5, Math.max(1, n));
  const level = 6 - clamped; // 1(ラク)→5★, 5(ツラい)→1★
  return "★".repeat(level) + "☆".repeat(5 - level);
}

// 「今どれくらいラクか」の絶対評価（主訴用だけに使う）
function scoreToComfortLabel(score) {
  const n = normalizeScore(score, null);
  if (n == null) return "今回がこれからの基準になります";

  if (n <= 1) return "かなりラクな状態です";
  if (n === 2) return "だいぶラクな状態です";
  if (n === 3) return "ほどほどの状態です";
  if (n === 4) return "ややツラめの状態です";
  return "かなりツラい状態です";
}

// ======== スコア差分 → 簡易コメント（矢印は使わない） ========
function buildTrendComment(prevVal, curVal, type = "general") {
  if (prevVal == null || curVal == null) {
    return type === "main"
      ? "今回が最初のチェックです。ここから一緒に見ていきましょう。"
      : "今回の値が、これからの目安になっていきます。";
  }

  const diff = prevVal - curVal; // 正なら「良くなった」（数字が小さいほどラク）

  if (diff >= 2) {
    return type === "main"
      ? "前回より、かなりラクさが増えています。"
      : "かなり整ってきている様子です。";
  }
  if (diff >= 1) {
    return type === "main"
      ? "少しラクさが増えてきました。"
      : "少しずつ整い傾向が見えています。";
  }
  if (diff <= -2) {
    return type === "main"
      ? "前回より、ツラさが強まりぎみです。"
      : "少し無理が重なっていそうな状態です。";
  }
  if (diff <= -1) {
    return type === "main"
      ? "少し負担が増えぎみです。"
      : "少し乱れが出ているようです。";
  }

  return type === "main"
    ? "大きな変化はまだ少なめですが、継続が力になります。"
    : "大きな変化はまだ少なめですが、様子見しながら続けていきましょう。";
}

// ======== ケア実施比率 → ゲージ ========
function careRatioToGauge(days, totalDays) {
  const d = days || 0;
  const base = totalDays || 1;
  const ratio = d / base; // 0.0〜1.0

  let level = 1;
  if (ratio >= 0.8) level = 5;
  else if (ratio >= 0.6) level = 4;
  else if (ratio >= 0.4) level = 3;
  else if (ratio > 0) level = 2;
  else level = 1;

  return "■".repeat(level) + "□".repeat(5 - level);
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
    symptomLabels[context.symptom] || "全身のなんとなくした不調";
  const motionName = context.motion || "指定の動き";

  // ---- トレンド情報・ゲージ用値 ----
  const mainTrendComment = buildTrendComment(
    prevScores?.symptom_level,
    curScores.symptom_level,
    "main"
  );
  const sleepTrendComment = buildTrendComment(
    prevScores?.sleep,
    curScores.sleep
  );
  const mealTrendComment = buildTrendComment(
    prevScores?.meal,
    curScores.meal
  );
  const stressTrendComment = buildTrendComment(
    prevScores?.stress,
    curScores.stress
  );
  const motionTrendComment = buildTrendComment(
    prevScores?.motion_level,
    curScores.motion_level
  );

  const prevMainStars = scoreToStars(prevScores?.symptom_level);
  const curMainStars = scoreToStars(curScores.symptom_level);
  const prevSleepStars = scoreToStars(prevScores?.sleep);
  const curSleepStars = scoreToStars(curScores.sleep);
  const prevMealStars = scoreToStars(prevScores?.meal);
  const curMealStars = scoreToStars(curScores.meal);
  const prevStressStars = scoreToStars(prevScores?.stress);
  const curStressStars = scoreToStars(curScores.stress);
  const prevMotionStars = scoreToStars(prevScores?.motion_level);
  const curMotionStars = scoreToStars(curScores.motion_level);

  const prevMainComfort = scoreToComfortLabel(prevScores?.symptom_level);
  const curMainComfort = scoreToComfortLabel(curScores.symptom_level);

  const hasPrevMain = prevScores && prevScores.symptom_level != null;

  // ---- カード1：体調＆構造の変化（ゲージ表示） ----
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
          wrap: true,
        },
      ],
      backgroundColor: "#7B9E76",
      paddingAll: "14px",
    },
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#F8F9F7",
      paddingAll: "16px",
      spacing: "lg",
      contents: [
        // --- 全体のととのい度 ---
        {
          type: "text",
          text: `🌡 主なお悩み（「${symptomName}」）のととのい度の変化`,
          weight: "bold",
          size: "md",
          wrap: true,
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            ...(hasPrevMain
              ? [
                  {
                    type: "text",
                    text: `前回：${prevMainStars} 〔${prevMainComfort}〕`,
                    size: "md",
                    wrap: true,
                  },
                ]
              : []),
            {
              type: "text",
              text: `今回：${curMainStars} 〔${curMainComfort}〕`,
              size: "md",
              wrap: true,
            },
            {
              type: "text",
              text: mainTrendComment,
              size: "sm",
              color: "#555555",
              margin: "sm",
              wrap: true,
            },
            {
              type: "text",
              text: "※★が多いほど「ラクに近い」状態です。",
              size: "xs",
              color: "#888888",
              margin: "sm",
              wrap: true,
            },
          ],
        },

        { type: "separator", margin: "lg" },

        // --- ととのいを支える要素 ---
        {
          type: "text",
          text: "🧩 ととのいを支える要素の変化（前回 → 今回）",
          weight: "bold",
          size: "md",
          wrap: true,
        },

        // 生活リズムブロック
        {
          type: "text",
          text: "🔹 生活リズムまわり",
          size: "sm",
          weight: "bold",
          margin: "md",
          wrap: true,
        },
        {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            {
              type: "box",
              layout: "vertical",
              spacing: "xs",
              contents: [
                {
                  type: "text",
                  text: "🌙 睡眠リズム",
                  size: "sm",
                  weight: "bold",
                  wrap: true,
                },
                {
                  type: "text",
                  text: `　前回：${prevSleepStars} ／ 今回：${curSleepStars}`,
                  size: "sm",
                  wrap: true,
                },
                {
                  type: "text",
                  text: `　ひとこと：${sleepTrendComment}`,
                  size: "xs",
                  color: "#555555",
                  wrap: true,
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              spacing: "xs",
              contents: [
                {
                  type: "text",
                  text: "🍽 食事のタイミング／量",
                  size: "sm",
                  weight: "bold",
                  wrap: true,
                },
                {
                  type: "text",
                  text: `　前回：${prevMealStars} ／ 今回：${curMealStars}`,
                  size: "sm",
                  wrap: true,
                },
                {
                  type: "text",
                  text: `　ひとこと：${mealTrendComment}`,
                  size: "xs",
                  color: "#555555",
                  wrap: true,
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              spacing: "xs",
              contents: [
                {
                  type: "text",
                  text: "😮‍💨 ストレス・気分の安定度",
                  size: "sm",
                  weight: "bold",
                  wrap: true,
                },
                {
                  type: "text",
                  text: `　前回：${prevStressStars} ／ 今回：${curStressStars}`,
                  size: "sm",
                  wrap: true,
                },
                {
                  type: "text",
                  text: `　ひとこと：${stressTrendComment}`,
                  size: "xs",
                  color: "#555555",
                  wrap: true,
                },
              ],
            },
          ],
        },

        // 構造（負荷チェック）
        {
          type: "text",
          text: "🔹 構造面のととのい（負荷チェック）",
          size: "sm",
          weight: "bold",
          margin: "md",
          wrap: true,
        },
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: `🧍‍♀️ 負荷チェック（${motionName}）`,
              size: "sm",
              weight: "bold",
              wrap: true,
            },
            {
              type: "text",
              text: `　前回：${prevMotionStars} ／ 今回：${curMotionStars}`,
              size: "sm",
              wrap: true,
            },
            {
              type: "text",
              text: `　ひとこと：${motionTrendComment}`,
              size: "xs",
              color: "#555555",
              wrap: true,
            },
          ],
        },
      ],
    },
  };

  // ---- カード2：ケア実施状況（ゲージのみ、コメントなし） ----

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
      label: "🌿 漢方・サプリ（おまけ枠）",
      count: careCounts.kampo ?? 0,
      adviceKey: "kanpo",
    },
  ];

  pillars.forEach((p) => {
    const gauge = careRatioToGauge(p.count, effDays);
    const block = {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      margin: "md",
      contents: [
        {
          type: "text",
          text: p.label,
          size: "sm",
          weight: "bold",
          wrap: true,
        },
        {
          type: "text",
          text: `　実施日数：${p.count}日 / ${effDays}日`,
          size: "sm",
          wrap: true,
        },
        {
          type: "text",
          text: `　実施ゲージ：［${gauge}］`,
          size: "sm",
          wrap: true,
        },
      ],
    };

    if (p.key === "kampo") {
      // 漢方・サプリは常にサポート側（おまけ枠）
      careLinesSupport.push(block);
    } else if (isPriority(p.adviceKey)) {
      careLinesPriority.push(block);
    } else {
      careLinesSupport.push(block);
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
            wrap: true,
          },
          ...careLinesPriority,
        ]
      : [];

  const supportBlock =
    careLinesSupport.length > 0
      ? [
          {
            type: "text",
            text: "＜サポートケア・おまけ枠＞",
            size: "sm",
            weight: "bold",
            margin: "md",
            wrap: true,
          },
          ...careLinesSupport,
        ]
      : [];

  const bubble2 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "🪴 ケア実施状況（前回チェック〜今回）",
          weight: "bold",
          size: "lg",
          color: "#ffffff",
          wrap: true,
        },
      ],
      backgroundColor: "#C6A047",
      paddingAll: "12px",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      backgroundColor: "#FDFBF7",
      paddingAll: "12px",
      contents: [
        {
          type: "text",
          text: "■が多いほど、そのケアを実施できた日が多い状態です。",
          size: "xs",
          color: "#555555",
          wrap: true,
        },
        { type: "separator", margin: "md" },
        ...priorityBlock,
        ...supportBlock,
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
            "「このケアがどのくらい体調に反映されていそうか知りたい」ときは、下のボタンからAIチャットに聞けます。",
          size: "sm",
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
        {
          type: "text",
          text: "形式が不正です。ボタンから選んで送信してください🙏",
        },
      ]);
    }

    // === 開始トリガー ===
    if (message === "ととのい度チェック開始") {
      const userRecord = await supabaseMemoryManager.getUser(lineId);
      if (
        !userRecord ||
        (!userRecord.subscribed && !userRecord.trial_intro_done)
      ) {
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

    // セッションが無いのにここに来た場合（異常系）
    if (!userSession[lineId]) {
      return client.replyMessage(replyToken, [
        {
          type: "text",
          text: 'ととのい度チェックを始めるには、メニューの【ととのい度チェック】ボタンをタップしてください😊',
        },
      ]);
    }

    const session = userSession[lineId];
    const question = questionSets[session.step - 1];

    // === 全問マルチ（key:value 形式） ===
    const parts = message.split(":");
    if (parts.length !== 2) {
      return client.replyMessage(replyToken, [
        {
          type: "text",
          text: "ボタンから選んで送信してください🙏",
        },
      ]);
    }

    const [key, answer] = parts;
    const validKey = question.options.find((opt) => opt.id === key);
    if (!validKey) {
      return client.replyMessage(replyToken, [
        {
          type: "text",
          text: "その選択肢は使えません。ボタンから選んでください🙏",
        },
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
      // 同一Q内で継続（ここでは返信しない。次のpostbackで続行）
      return;
    }

    // === 全問完了時 ===
    if (session.step > questionSets.length) {
      const answers = session.answers;

      // 1. context + userRecord を取得
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

// 2. 前回までの followup 履歴を取得（保存より前）
const { latest, prev } =
  await supabaseMemoryManager.getLastTwoFollowupsByUserId(
    userRecord.id
  );

const curScores = {
  symptom_level: normalizeScore(
    answers.symptom ?? latest?.symptom_level ?? latest?.symptom,
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

// ✅ 「前回のスコア」は latest（直近の記録）を使う
const prevScores = latest ? normalizeFollowupRow(latest) : null;


// 3. ケア実施日数（前回チェック〜今回）
let careCounts = {};
try {
  // 🩵 AIチャットと同じ呼び方に揃える
  //    - 内部で「前回 followup 〜 今」 or 「context 〜 今」を判定してくれる前提
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
      
// 4. 評価対象日数（前回〜今回 or context開始〜今回）
const now = Date.now();
const lastCheckDate = latest?.created_at
  ? new Date(latest.created_at).getTime()
  : null;
const contextDate = context?.created_at
  ? new Date(context.created_at).getTime()
  : null;

const diffDays = lastCheckDate
  ? Math.ceil((now - lastCheckDate) / (1000 * 60 * 60 * 24))
  : contextDate
  ? Math.ceil((now - contextDate) / (1000 * 60 * 60 * 24))
  : 1;

const effectiveDays = Math.max(1, diffDays);

      // 5. 表示用バブル生成
      const { bubbles, ctaBubble } = buildResultBubbles({
        context,
        prevScores,
        curScores,
        careCounts,
        effectiveDays,
      });

      // 6. Supabaseへ保存（prev取得・care集計の「あと」で実施）
      await supabaseMemoryManager.setFollowupAnswers(lineId, answers);

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

    // === 次の質問へ ===
    const nextQuestion = questionSets[session.step - 1];
    const context = await supabaseMemoryManager.getContext(lineId);
    const nextFlex = buildFlexMessage(nextQuestion, context);
    return client.replyMessage(replyToken, [nextFlex]);
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
