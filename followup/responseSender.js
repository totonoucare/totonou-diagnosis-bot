// followup/responseSender.js
// 定期チェック：前回差分＋「褒めて伸ばす」＋点数/星の確定計算（gpt-5）
// JSON構造（sections）も返す：{ lead, score_header, diff_line, keep_doing[], next_steps[], footer }
// contents.advice は jsonb配列（[{header, body}, ...] または {habits,...}）想定

const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 5本柱ラベル
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

// ===== 正規化：数値化・欠損補填 =====
function normalizeFollowup(ans = {}) {
  const n = (v, def) => (v === null || v === undefined || v === "" ? def : Number(v));
  return {
    symptom_level: n(ans.symptom_level, 3),
    sleep:  n(ans.sleep, 3),
    meal:   n(ans.meal, 3),
    stress: n(ans.stress, 3),
    habits:    ans.habits ?? "未着手",
    breathing: ans.breathing ?? "未着手",
    stretch:   ans.stretch ?? "未着手",
    tsubo:     ans.tsubo ?? "未着手",
    kampo:     ans.kampo ?? "未着手",
    motion_level: n(ans.motion_level, 3)
  };
}

// ===== スコア算定（0〜100）＋星（1〜5） =====
const careMap = { "継続": 0, "継続中": 0, "時々": 1, "未着手": 2 };
const isWeak = (v) => v === "未着手" || v === "時々";

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

function computeScore(ans) {
  let penalty = 0;
  penalty += (ans.symptom_level - 1) * 7.0;
  penalty += ((ans.sleep - 1) + (ans.meal - 1) + (ans.stress - 1)) * 2.333;
  const careVals = [ans.habits, ans.breathing, ans.stretch, ans.tsubo];
  const careScore = careVals.reduce((acc, v) => acc + (careMap[v] ?? 0), 0);
  penalty += careScore * 2;
  penalty += (ans.motion_level - 1) * 2.5;
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

// ===== 次の一歩（どの柱を前面に） =====
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

// ===== メイン：フォローアップコメント生成 =====
async function sendFollowupResponse(userId, followupAnswers) {
  try {
    const users = await supabaseMemoryManager.getSubscribedUsers();
    const user = users.find((u) => u.id === userId);
    if (!user || !user.line_id) {
      throw new Error(`userId=${userId} に対応する line_id が見つかりません`);
    }
    const lineId = user.line_id;

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

    const { latest, prev } = await supabaseMemoryManager.getLastTwoFollowupsByUserId(userId);
    const curN  = normalizeFollowup(followupAnswers || latest);
    const prevN = prev ? normalizeFollowup(prev) : null;

    if (!curN) {
      return {
        gptComment: "今回は記録が見つかりませんでした。もう一度、定期チェックを送ってください。",
        statusMessage: "no-current",
      };
    }

    const { score, stars } = computeScore(curN);
    const prevScore = prevN ? computeScore(prevN).score : null;
    const delta = prevScore === null ? null : (score - prevScore);

    const header = (prevScore === null)
      ? `今週の整いスコア：${score}点 ${stars}`
      : `前回：${prevScore}点 → 今週：${score}点（${delta>0?'+':''}${delta}） ${stars}`;

    // diffLine を拡張：点数変化＋何が改善/悪化したか
    const praise = prevN ? pickPraise(prevN, curN) : [];
    const bottleneck = pickBottleneck(curN);
    const praiseTxt = praise.length ? praise.map(p=>`${p.label}が改善`).join("・") : null;
    const bottleneckTxt = bottleneck ? `特に「${bottleneck.label}」の負担が目立ちます。` : "";

    let diffLine;
    if (prevScore === null) {
      diffLine = "今回が初回のチェックです。次回から変化を追えます。";
    } else if (delta > 0) {
      diffLine = `前回より +${delta} 点の改善です。${praiseTxt ? praiseTxt+" が良くなっています。" : ""}`;
    } else if (delta < 0) {
      diffLine = `前回より ${delta} 点の低下です。${bottleneckTxt || "無理なく一箇所ずつ整え直しましょう。"}`;
    } else {
      diffLine = "前回と同じスコア（現状維持）です。小さな積み重ねを続けましょう。";
    }

    const nextPillar = chooseNextPillar(curN);
    const rawNextStep = adviceObj[nextPillar] && String(adviceObj[nextPillar]).trim();
    const nextStepText = rawNextStep
      ? `今回の課題は「${pillarLabelMap[nextPillar]}」。${bottleneckTxt} そのためにおすすめなのは次のケアです：${rawNextStep}`
      : "今日は1分だけでも、自分のケア時間を作ってみましょう。呼吸をゆっくり、心地よく。";

    // === GPT JSON生成 ===
    const systemJson = `
あなたは「ととのうAI」。ユーザーの因果（habits ↔ sleep/meal/stressの改善、breathing=stressの改善や自律調整力の底上げ、stretch/tsubo=motion_levelの直接的な改善）を理解して、
なぜ提示するのか理由を添えてフィードバックします。
必ず有効なJSONのみ返してください。

{
  "lead": "冒頭ひとこと（親しみやすく2〜3文）",
  "score_header": "headerそのまま",
  "diff_line": "diffLineそのまま",
  "keep_doing": ["続けると良いこと＋なぜ良いか理由（因果に基づき2〜3項目）"],
  "next_steps": ["次のステップ＋なぜ必要か（因果に基づき、nextStepTextを含めて1〜2項目）"],
  "footer": "締めのひとこと＋注意書き"
}
`.trim();

    const userJson = `
score_header: ${header}
diffLine: ${diffLine}
主訴: ${symptomJapanese}
次の一歩pillar: ${pillarLabelMap[nextPillar]}
nextStepText: ${nextStepText}
`.trim();

    const sections = await callGPTJson(systemJson, userJson);

    // === fallbackは省略（元コードと同様） ===
    // ...（同じ処理を残して良い）

    return { sections, gptComment: JSON.stringify(sections, null, 2), statusMessage: "ok" };

  } catch (error) {
    console.error("sendFollowupResponse error:", error);
    return {
      sections: null,
      gptComment: "今週のフィードバック生成に失敗しました。時間を置いて再実行してください。",
      statusMessage: "error",
    };
  }
}

async function callGPTJson(systemPrompt, userPrompt) {
  try {
    const rsp = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt  },
      ],
      response_format: { type: "json_object" }
    });
    let raw = rsp.choices?.[0]?.message?.content?.trim() || "";
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = { sendFollowupResponse };
