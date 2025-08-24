// followup/responseSender.js
// 定期チェック：前回差分＋「褒めて伸ばす」＋点数/星の確定計算（gpt-5）
// contents.advice は jsonb配列（[{header, body}, ...] または {habits,...}）想定

const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 5本柱の日本語ラベル
const pillarLabelMap = {
  habits:   "体質改善習慣",
  breathing:"呼吸法",
  stretch:  "ストレッチ",
  tsubo:    "ツボ",
  kampo:    "漢方薬",
};

// 主訴の日本語
const symptomMap = {
  stomach: "胃腸の調子",
  sleep: "睡眠・集中力",
  pain: "肩こり・腰痛・関節痛",
  mental: "イライラや不安感",
  cold: "冷え・のぼせ・むくみ",
  skin: "頭皮や肌トラブル",
  pollen: "花粉症や鼻炎",
  women: "女性特有のお悩み",
  unknown: "なんとなく不調・不定愁訴",
};

/** contents.advice → 5本柱テキストへマッピング */
function readAdvice(adviceInput) {
  if (!adviceInput) {
    return { habits: "", breathing: "", stretch: "", tsubo: "", kampo: "" };
  }
  if (!Array.isArray(adviceInput) && typeof adviceInput === "object") {
    const { habits = "", breathing = "", stretch = "", tsubo = "", kampo = "" } = adviceInput;
    return { habits, breathing, stretch, tsubo, kampo };
  }
  const arr = Array.isArray(adviceInput) ? adviceInput : [];
  const pick = (keywords) => {
    const item = arr.find(a => typeof a?.header === "string" && keywords.some(kw => a.header.includes(kw)));
    return item?.body ? String(item.body).trim() : "";
  };
  return {
    habits:   pick(["体質改善習慣", "まずはここから"]),
    breathing:pick(["呼吸法", "巡りととのう呼吸"]),
    stretch:  pick(["ストレッチ", "経絡", "けいらく"]),
    tsubo:    pick(["ツボ", "ツボケア"]),
    kampo:    pick(["漢方", "漢方薬"]),
  };
}

// ===== 正規化：数値化・欠損補填（ここが超重要） =====
function normalizeFollowup(ans = {}) {
  const n = (v, def) => (v === null || v === undefined || v === "" ? def : Number(v));
  return {
    // Q1
    symptom_level: n(ans.symptom_level, 3),
    general_level: n(ans.general_level, 3),
    // Q2
    sleep:  n(ans.sleep, 3),
    meal:   n(ans.meal, 3),
    stress: n(ans.stress, 3),
    // Q3（テキストのまま）
    habits:    ans.habits ?? "未着手",
    breathing: ans.breathing ?? "未着手",
    stretch:   ans.stretch ?? "未着手",
    tsubo:     ans.tsubo ?? "未着手",
    kampo:     ans.kampo ?? "未着手",
    // Q4
    motion_level: n(ans.motion_level, 3),
    // Q5
    q5_answer: ans.q5_answer ?? ""
  };
}

// ===== スコア算定（0〜100）＋星（1〜5） =====
const careMap = { "継続": 0, "継続中": 0, "時々": 1, "未着手": 2 };
const isWeak = (v) => v === "未着手" || v === "時々";

/** contents.advice と照合した “アドヒアランス修正”減点（※漢方は減点しない） */
function adherencePenalty(ans) {
  let add = 0;
  if (ans.sleep >= 3 && isWeak(ans.habits))    add += 1.5;
  if (ans.meal  >= 3 && isWeak(ans.habits))    add += 1.5;
  if (ans.stress>= 3 && isWeak(ans.breathing)) add += 1.5;
  if (ans.motion_level >= 3) {
    if (isWeak(ans.stretch) && isWeak(ans.tsubo)) add += 2.0;
    else if (isWeak(ans.stretch) || isWeak(ans.tsubo)) add += 1.0;
  }
  return add;
}

/** 減点法：Q1(35%) + Q2(35%) + Q3(20%) + Q4(10%) + アドヒアランス修正 */
function computeScore(ans) {
  let penalty = 0;
  // Q1
  penalty += ((ans.symptom_level - 1) + (ans.general_level - 1)) * 3.5;
  // Q2
  penalty += ((ans.sleep - 1) + (ans.meal - 1) + (ans.stress - 1)) * 2.333;
  // Q3（漢方除外）
  const careVals = [ans.habits, ans.breathing, ans.stretch, ans.tsubo];
  const careScore = careVals.reduce((acc, v) => acc + (careMap[v] ?? 0), 0);
  penalty += careScore * 2;
  // Q4
  penalty += (ans.motion_level - 1) * 2.5;
  // アドヒアランス修正
  penalty += adherencePenalty(ans);

  const raw = 100 - penalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const starsNum = Math.max(1, Math.min(5, Math.ceil(score / 20)));
  const stars = "★".repeat(starsNum) + "☆".repeat(5 - starsNum);
  return { score, stars, starsNum };
}

// ===== 改善点（前回→今回で下がった項目=改善） =====
function pickPraise(prev, cur) {
  if (!prev) return [];
  const diffs = [
    { key: "symptom_level", label: "主訴",     d: prev.symptom_level - cur.symptom_level },
    { key: "sleep",         label: "睡眠",     d: prev.sleep - cur.sleep },
    { key: "meal",          label: "食事",     d: prev.meal - cur.meal },
    { key: "stress",        label: "ストレス", d: prev.stress - cur.stress },
    { key: "motion_level",  label: "動作",     d: prev.motion_level - cur.motion_level },
  ];
  return diffs.filter(x => x.d > 0).sort((a,b) => b.d - a.d).slice(0, 2);
}

// ===== ボトルネック（今回値が高い=乱れ） =====
function pickBottleneck(cur) {
  const arr = [
    { key: "meal",         label: "食事",     v: cur.meal },
    { key: "sleep",        label: "睡眠",     v: cur.sleep },
    { key: "stress",       label: "ストレス", v: cur.stress },
    { key: "motion_level", label: "動作",     v: cur.motion_level },
  ];
  return arr.filter(c => c.v >= 3).sort((a,b) => b.v - a.v)[0] || null;
}

// ===== 次の一歩 =====
function chooseNextPillar(ans) {
  const pillars = [
    { k: "breathing", v: ans.breathing },
    { k: "stretch",   v: ans.stretch },
    { k: "tsubo",     v: ans.tsubo },
    { k: "kampo",     v: ans.kampo },
    { k: "habits",    v: ans.habits },
  ];
  const notStarted = pillars.find(p => (p.v || "") === "未着手");
  if (notStarted) return notStarted.k;
  if (ans.stress >= 3) return "breathing";
  if (ans.meal   >= 3) return (ans.kampo === "未着手" ? "kampo" : "habits");
  if (ans.motion_level >= 3) return (ans.stretch === "未着手" ? "stretch" : "tsubo");
  if (ans.sleep  >= 3) return (ans.breathing === "未着手" ? "breathing" : "habits");
  return "habits";
}

// ===== GPT呼び出し（フォールバック込み） =====
async function callGPTWithFallback(systemPrompt, userPrompt) {
  let rsp = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 640
  });
  let text = rsp.choices?.[0]?.message?.content?.trim() || "";

  if (!text) {
    rsp = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 480
    });
    text = rsp.choices?.[0]?.message?.content?.trim() || "";
  }

  return text;
}

// ===== メイン：フォローアップコメント生成 =====
async function sendFollowupResponse(userId, followupAnswers) {
  try {
    // userId → lineId
    const users = await supabaseMemoryManager.getSubscribedUsers();
    const user = users.find((u) => u.id === userId);
    if (!user || !user.line_id) {
      throw new Error(`userId=${userId} に対応する line_id が見つかりません`);
    }
    const lineId = user.line_id;

    // コンテキスト（advice・symptom）
    const context = await supabaseMemoryManager.getContext(lineId);
    if (!context) {
      return {
        gptComment: "初回の体質ケア情報が見つかりませんでした。はじめに体質分析からお試しください。",
        statusMessage: "no-current",
      };
    }
    const { advice, symptom } = context;
    const adviceObj = readAdvice(advice);
    const symptomJapanese = symptomMap[symptom] || symptom || "未登録";

    // 直近2件（今回=引数 or 最新 / 前回=その一つ前）
    const { latest, prev } = await supabaseMemoryManager.getLastTwoFollowupsByUserId(userId);

    // ★ 正規化（ここがキモ：文字列・null 混入を排除）
    const curN  = normalizeFollowup(followupAnswers || latest);
    const prevN = prev ? normalizeFollowup(prev) : null;

    if (!curN) {
      return {
        gptComment: "今回は記録が見つかりませんでした。もう一度、定期チェックを送ってください。",
        statusMessage: "no-current",
      };
    }

    // スコア＆差分（両方“確定値”にする）
    const { score, stars } = computeScore(curN);
    const prevScore = prevN ? computeScore(prevN).score : null;
    const delta = prevScore === null ? null : (score - prevScore);

    // ヘッダは “実数の比較” を常に表示（初回のみ今週だけ）
    const header = (prevScore === null)
      ? `今週の整いスコア：${score}点 ${stars}`
      : `前回：${prevScore}点 → 今週：${score}点（${delta>0?'+':''}${delta}） ${stars}`;

    // 前回比の短評（固定文）
    const diffLine =
      prevScore === null ? "今回が初回のチェックです。次回から変化を追えます。"
      : delta > 0        ? `前回より +${delta} 点の改善です。良い流れをキープしましょう。`
      : delta < 0        ? `前回より ${delta} 点の低下です。無理なく一箇所だけ整え直しましょう。`
                         : "前回と同じスコア（現状維持）です。土台はできています。";

    // 褒めポイント・課題・次の一歩
    const praise = prevN ? pickPraise(prevN, curN) : [];
    const bottleneck = pickBottleneck(curN);
    const nextPillar = chooseNextPillar(curN);
    const nextStepText =
      adviceObj[nextPillar] && String(adviceObj[nextPillar]).trim()
        ? String(adviceObj[nextPillar]).trim()
        : "今日は1分だけでも、自分のケア時間を作ってみましょう。呼吸をゆっくり、心地よく。";

    // ===== GPT プロンプト =====
    const systemPrompt = `
あなたは「ととのうAI」。東洋医学の体質ケアに基づき、定期チェック結果から“褒めて伸ばす”コメントを作ります。
出力は次の形式・条件を厳守してください。

【形式（すべて必須）】
1) 冒頭：全体の体調・変化をひと言（親しみやすく、絵文字OK）
2) 直後に header をそのまま1行で記載（計算済みの点/星/差分）
3) 見出し「前回比」：1行で短評（diffLine をそのまま使う）
4) 見出し「このまま続けるといいこと」：2〜3点（具体承認）
5) 見出し「次にやってみてほしいこと」：1〜2点（必ず nextStep を含む）
6) 締めのひとこと（前向き）
※ 箇条書きに絵文字は使って良いが、*-# 等の記号は使わない。

【制約】
- 全角250〜350字
- praise が空でも、今できている小さな取り組みを具体承認する
- bottleneck があれば1点だけ触れる（やさしく課題提示）
- nextPillar に対応する nextStep を本文に必ず含める（意味改変禁止、言い換え可）
- 最後に注意書き：「※本サービスは医療行為ではなくセルフケア支援です。」
`.trim();

    const userPrompt = `
【header】
${header}

【前回比】
${diffLine}

【主訴】${symptomJapanese}

【今回の定期チェック】
Q1: 主訴=${curN.symptom_level} / 全体=${curN.general_level}
Q2: 睡眠=${curN.sleep} / 食事=${curN.meal} / ストレス=${curN.stress}
Q3: 習慣=${curN.habits} / 呼吸法=${curN.breathing} / ストレッチ=${curN.stretch} / ツボ=${curN.tsubo} / 漢方薬=${curN.kampo}
Q4: 動作=${curN.motion_level}
Q5: 困りごと=${curN.q5_answer || "未入力"}

【改善点（前回→今回で良化）】
${praise.map(p => `${p.label}: ${p.d} 段階改善`).join(" / ") || "（特記事項なし）"}

【課題候補】
${bottleneck ? `${bottleneck.label}（スコア${bottleneck.v}）` : "（特記事項なし）"}

【次の一歩（柱と本文）】
pillar: ${pillarLabelMap[nextPillar] || "次の一歩"}
nextStep: ${nextStepText}
`.trim();

    // ===== GPT呼び出し =====
    let replyText = await callGPTWithFallback(systemPrompt, userPrompt);

    // ===== フォールバック =====
    if (!replyText) {
      const praiseLine = (praise && praise.length)
        ? `👏このまま続けるといいこと：${praise.map(p => `${p.label}が${p.d}段階よくなっています`).join("・")}。`
        : `👏このまま続けるといいこと：小さな積み重ねができています。`;

      const taskLine = bottleneck
        ? `🧭今週の課題：${bottleneck.label}（スコア${bottleneck.v}）。`
        : `🧭今週の課題：基礎の継続。`;

      const pillarJa = pillarLabelMap[nextPillar] || "次の一歩";
      const fallbackText =
        `${header}\n` +
        `🔁前回比：${diffLine}\n` +
        `${praiseLine}\n` +
        `${taskLine}\n` +
        `➡️次にやってほしいこと（${pillarJa}）：${nextStepText}\n` +
        `※本サービスは医療行為ではなくセルフケア支援です。`;

      return { gptComment: fallbackText, statusMessage: "fallback" };
    }

    return { gptComment: replyText, statusMessage: "ok" };

  } catch (error) {
    console.error("sendFollowupResponse error:", error);
    return {
      gptComment: "今週のフィードバック生成に失敗しました。時間を置いて再実行してください。",
      statusMessage: "error",
    };
  }
}

module.exports = { sendFollowupResponse };
