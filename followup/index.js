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
  symptom: "「{{symptom}}」のツラさ",
  sleep: "睡眠のリズム/質",
  meal: "食事のタイミング/バランス",
  stress: "ストレス・気分の安定度",
  motion_level: "「{{motion}}」のツラさ",
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

// ======== 結果バブル構築（リッチ版：2枚＋CTA） ========
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
  const sleepTrendComment = buildTrendComment(prevScores?.sleep, curScores.sleep);
  const mealTrendComment  = buildTrendComment(prevScores?.meal, curScores.meal);
  const stressTrendComment= buildTrendComment(prevScores?.stress, curScores.stress);
  const motionTrendComment= buildTrendComment(prevScores?.motion_level, curScores.motion_level);

  const prevMainStars   = scoreToStars(prevScores?.symptom_level);
  const curMainStars    = scoreToStars(curScores.symptom_level);
  const prevSleepStars  = scoreToStars(prevScores?.sleep);
  const curSleepStars   = scoreToStars(curScores.sleep);
  const prevMealStars   = scoreToStars(prevScores?.meal);
  const curMealStars    = scoreToStars(curScores.meal);
  const prevStressStars = scoreToStars(prevScores?.stress);
  const curStressStars  = scoreToStars(curScores.stress);
  const prevMotionStars = scoreToStars(prevScores?.motion_level);
  const curMotionStars  = scoreToStars(curScores.motion_level);

  const prevMainComfort = scoreToComfortLabel(prevScores?.symptom_level);
  const curMainComfort  = scoreToComfortLabel(curScores.symptom_level);

  const hasPrevMain = prevScores && prevScores.symptom_level != null;

  // ======== Theme / Helper ========
  const theme = {
    green: "#7B9E76",
    greenDeep: "#5F7F59",
    gold: "#C6A047",
    bodyBg: "#F8F9F7",
    bodyBgGold: "#FDFBF7",
    cardBg: "#FFFFFF",
    border: "#DDE6DB",
    text: "#0d0d0d",
    muted: "#666666",
    subtle: "#888888",
  };

  const headerBox = (title, bg) => ({
    type: "box",
    layout: "vertical",
    backgroundColor: bg,
    paddingAll: "14px",
    contents: [
      {
        type: "text",
        text: title,
        weight: "bold",
        size: "lg",
        color: "#ffffff",
        wrap: true,
      },
    ],
  });

  const pill = (text, bg, color = "#ffffff") => ({
    type: "box",
    layout: "vertical",
    flex: 0,
    paddingAll: "6px",
    cornerRadius: "999px",
    backgroundColor: bg,
    contents: [
      {
        type: "text",
        text,
        size: "xs",
        weight: "bold",
        color,
        align: "center",
      },
    ],
  });

  const card = (contents, { bg = theme.cardBg, margin = "md" } = {}) => ({
    type: "box",
    layout: "vertical",
    backgroundColor: bg,
    cornerRadius: "14px",
    paddingAll: "12px",
    borderWidth: "1px",
    borderColor: theme.border,
    margin,
    contents,
  });

  const twoColPrevCur = ({ prevText, prevSub, curText, curSub }) => {
    const left = card(
      [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            pill("前回", theme.greenDeep),
            { type: "filler" },
          ],
        },
        {
          type: "text",
          text: prevText,
          size: "md",
          weight: "bold",
          color: theme.text,
          wrap: true,
          margin: "sm",
        },
        ...(prevSub
          ? [
              {
                type: "text",
                text: prevSub,
                size: "xs",
                color: theme.muted,
                wrap: true,
                margin: "xs",
              },
            ]
          : []),
      ],
      { margin: "none" }
    );

    const right = card(
      [
        {
          type: "box",
          layout: "horizontal",
          contents: [pill("今回", theme.green), { type: "filler" }],
        },
        {
          type: "text",
          text: curText,
          size: "md",
          weight: "bold",
          color: theme.text,
          wrap: true,
          margin: "sm",
        },
        ...(curSub
          ? [
              {
                type: "text",
                text: curSub,
                size: "xs",
                color: theme.muted,
                wrap: true,
                margin: "xs",
              },
            ]
          : []),
      ],
      { margin: "none" }
    );

    // 前回が無い場合は「今回」だけ大きく
    if (!hasPrevMain) {
      return [
        card(
          [
            {
              type: "box",
              layout: "horizontal",
              contents: [pill("今回", theme.green), { type: "filler" }],
            },
            {
              type: "text",
              text: curText,
              size: "lg",
              weight: "bold",
              color: theme.text,
              wrap: true,
              margin: "sm",
            },
            ...(curSub
              ? [
                  {
                    type: "text",
                    text: curSub,
                    size: "sm",
                    color: theme.muted,
                    wrap: true,
                    margin: "xs",
                  },
                ]
              : []),
          ],
          { margin: "md" }
        ),
      ];
    }

    return [
      {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        margin: "md",
        contents: [left, right],
      },
    ];
  };

  const metricRow = (icon, title, prevStars, curStars, comment) =>
    card(
      [
        {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            { type: "text", text: icon, size: "md", flex: 0 },
            {
              type: "text",
              text: title,
              size: "md",
              weight: "bold",
              color: theme.text,
              wrap: true,
              flex: 1,
            },
          ],
        },
        {
          type: "text",
          text: `前回：${prevStars}　／　今回：${curStars}`,
          size: "sm",
          color: theme.text,
          wrap: true,
          margin: "sm",
        },
        {
          type: "text",
          text: comment,
          size: "sm",
          color: theme.muted,
          wrap: true,
          margin: "xs",
        },
      ],
      { margin: "md" }
    );

  // ---- カード1：変化（リッチ） ----
  const bubble1 = {
    type: "bubble",
    size: "mega",
    header: headerBox("📊 今週のととのいチェック結果", theme.green),
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: theme.bodyBg,
      paddingAll: "16px",
      spacing: "md",
      contents: [
        // 主訴
        card(
          [
            {
              type: "text",
              text: `🌡 主なお悩み（${symptomName}）`,
              size: "md",
              weight: "bold",
              color: theme.text,
              wrap: true,
            },
            {
              type: "text",
              text: "★が多いほど「ラクに近い」状態です。",
              size: "xs",
              color: theme.subtle,
              wrap: true,
              margin: "xs",
            },
            ...twoColPrevCur({
              prevText: prevMainStars,
              prevSub: prevMainComfort,
              curText: curMainStars,
              curSub: curMainComfort,
            }),
            {
              type: "separator",
              margin: "md",
            },
            {
              type: "text",
              text: mainTrendComment,
              size: "md",
              weight: "bold",
              color: theme.text,
              wrap: true,
              margin: "md",
            },
          ],
          { margin: "none" }
        ),

        // 支える要素
        card(
          [
            {
              type: "text",
              text: "🧩 ととのいを支える要素",
              size: "md",
              weight: "bold",
              color: theme.text,
              wrap: true,
            },
            {
              type: "text",
              text: "生活・こころ・体のラインを分けて見ます。",
              size: "sm",
              color: theme.muted,
              wrap: true,
              margin: "xs",
            },
          ],
          { margin: "md" }
        ),

        // 生活・こころ
        metricRow("🌙", "睡眠（リズム／質）", prevSleepStars, curSleepStars, sleepTrendComment),
        metricRow("🍽", "食事（タイミング／バランス）", prevMealStars, curMealStars, mealTrendComment),
        metricRow("😮‍💨", "ストレス・気分の安定度", prevStressStars, curStressStars, stressTrendComment),

        // 体表ライン（負荷チェック）
        metricRow("🧍‍♀️", `体表ライン（負荷チェック：${motionName}）`, prevMotionStars, curMotionStars, motionTrendComment),
      ],
    },
  };

  // ---- カード2：ケア実施状況（リッチ） ----
  const adviceCards = Array.isArray(context.advice) ? context.advice : [];
  const priorityKeys = adviceCards
    .filter((c) => c.priority === 1 && c.key)
    .map((c) => c.key);

  const isPriority = (key) => priorityKeys.includes(key);

  const effDays = effectiveDays || 1;

  const pillars = [
    { key: "breathing", label: "🌬 呼吸法", count: careCounts.breathing ?? 0, adviceKey: "breathing" },
    { key: "stretch",   label: "🤸‍♀️ 経絡ストレッチ", count: careCounts.stretch ?? 0, adviceKey: "stretch" },
    { key: "tsubo",     label: "👉 指先・ツボほぐし", count: careCounts.tsubo ?? 0, adviceKey: "points" },
    { key: "habits",    label: "🌱 体質改善習慣（生活）", count: careCounts.habits ?? 0, adviceKey: "lifestyle" },
    { key: "kampo",     label: "🌿 漢方・サプリ（おまけ）", count: careCounts.kampo ?? 0, adviceKey: "kanpo" },
  ];

  const lineBlock = (p) => {
    const gauge = careRatioToGauge(p.count, effDays);
    return card(
      [
        {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: p.label,
              size: "md",
              weight: "bold",
              color: theme.text,
              wrap: true,
              flex: 1,
            },
            pill(`［${gauge}］`, theme.bodyBg, theme.greenDeep),
          ],
        },
        {
          type: "text",
          text: `実施日数：${p.count}日 / ${effDays}日`,
          size: "sm",
          color: theme.muted,
          wrap: true,
          margin: "sm",
        },
      ],
      { margin: "md" }
    );
  };

  const priorityList = [];
  const supportList = [];

  for (const p of pillars) {
    if (p.key === "kampo") {
      supportList.push(lineBlock(p));
    } else if (isPriority(p.adviceKey)) {
      priorityList.push(lineBlock(p));
    } else {
      supportList.push(lineBlock(p));
    }
  }

  const bubble2 = {
    type: "bubble",
    size: "mega",
    header: headerBox("🪴 ケア実施状況（前回〜今回）", theme.gold),
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: theme.bodyBgGold,
      paddingAll: "16px",
      spacing: "md",
      contents: [
        card(
          [
            {
              type: "text",
              text: "■が多いほど、そのケアを実施できた日が多い状態です。",
              size: "sm",
              color: theme.muted,
              wrap: true,
            },
          ],
          { margin: "none", bg: theme.cardBg }
        ),

        ...(priorityList.length
          ? [
              {
                type: "box",
                layout: "horizontal",
                margin: "md",
                contents: [pill("優先ケア", theme.gold), { type: "filler" }],
              },
              ...priorityList,
            ]
          : []),

        ...(supportList.length
          ? [
              {
                type: "box",
                layout: "horizontal",
                margin: "md",
                contents: [pill("サポート・おまけ", "#B0B0B0"), { type: "filler" }],
              },
              ...supportList,
            ]
          : []),
      ],
    },
  };

  // ---- CTA バブル（リッチ） ----
  const ctaBubble = {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: theme.cardBg,
      paddingAll: "16px",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: "🧠 ケア効果の反映具合を聞く",
          weight: "bold",
          size: "lg",
          color: theme.text,
          wrap: true,
        },
        {
          type: "text",
          text:
            "今回の変化と実施状況を踏まえて、\n「どのケアが功を奏してそう？」「どれが足りないかも？」をトトノウくんが整理します。",
          size: "md",
          color: theme.muted,
          wrap: true,
        },
        {
          type: "box",
          layout: "vertical",
          backgroundColor: theme.bodyBg,
          cornerRadius: "14px",
          paddingAll: "12px",
          borderWidth: "1px",
          borderColor: theme.border,
          contents: [
            {
              type: "text",
              text: "📬 からだの巡り通信（週1）でも、ここでの内容を“やさしく要約”してお届けします。",
              size: "sm",
              color: theme.muted,
              wrap: true,
            },
          ],
        },
        {
          type: "button",
          style: "primary",
          color: theme.green,
          action: {
            type: "message",
            label: "ケア効果の反映具合を聞く",
            text: "ケア効果の反映具合を聞く",
          },
        },
        {
          type: "text",
          text: "※ 返信に少し時間がかかることがあります",
          size: "xs",
          color: theme.subtle,
          wrap: true,
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

      // 2. 今回の回答を先に保存しておく（この時点で「最新のfollowup」が1件増える）
      await supabaseMemoryManager.setFollowupAnswers(lineId, answers);

      // 3. 保存後の followup 履歴（直近2件）を取得
      //    latest = 今回のチェック結果 / prev = 前回のチェック結果
      const { latest, prev } =
        await supabaseMemoryManager.getLastTwoFollowupsByUserId(
          userRecord.id
        );

      // 4. スコア構造を整形
      //    curScores は今回回答そのものを使う（DBを再参照しなくてOK）
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

      // 「前回のスコア」は prev（1つ前のfollowup）を使う
      const prevScores = prev ? normalizeFollowupRow(prev) : null;

      // 5. ケア実施日数（前回チェック〜今回）
      //    → オプション無しで呼び、AIチャット／リマインダーと同じ区間ロジックを使う
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

      // 6. 評価対象日数（前回〜今回 or context開始〜今回）
      //    start = prev.created_at || context.created_at
      //    end   = latest.created_at（今回のチェック）
      const now = Date.now();
      const latestDate = latest?.created_at
        ? new Date(latest.created_at).getTime()
        : null;
      const prevDate = prev?.created_at
        ? new Date(prev.created_at).getTime()
        : null;
      const contextDate = context?.created_at
        ? new Date(context.created_at).getTime()
        : null;

      const start = prevDate ?? contextDate ?? latestDate ?? now;
      const end = latestDate ?? now;

      const diffDays = Math.max(
        1,
        Math.ceil((end - start) / (1000 * 60 * 60 * 24))
      );
      const effectiveDays = diffDays;

      // 7. 表示用バブル生成
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
