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
    // Q1（general_level は廃止）
    symptom_level: n(ans.symptom_level, 3),
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
    motion_level: n(ans.motion_level, 3)
  };
}

// ===== スコア算定（0〜100）＋星（1〜5） =====
const careMap = { "継続": 0, "継続中": 0, "時々": 1, "未着手": 2 };
const isWeak = (v) => v === "未着手" || v === "時々";

function adherencePenalty(ans) {
  let add = 0;
  // Q2 × advice
  if (ans.sleep >= 3 && isWeak(ans.habits))    add += 1.5;
  if (ans.meal  >= 3 && isWeak(ans.habits))    add += 1.5;
  if (ans.stress>= 3 && isWeak(ans.breathing)) add += 1.5;
  // Q4 × advice
  if (ans.motion_level >= 3) {
    if (isWeak(ans.stretch) && isWeak(ans.tsubo)) add += 2.0;
    else if (isWeak(ans.stretch) || isWeak(ans.tsubo)) add += 1.0;
  }
  return add;
}

/** 減点法：Q1(35%) + Q2(35%) + Q3(20%) + Q4(10%) + アドヒアランス修正
 *  Q1は general_level 廃止に伴い、「主訴」のみで同等ウエイトになるよう係数を倍に調整。
 */
function computeScore(ans) {
  let penalty = 0;
  // Q1（symptom_level のみ。最大減点28を維持するため係数7.0）
  penalty += (ans.symptom_level - 1) * 7.0;
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

// ===== 次の一歩（どの柱を前面に） =====
function chooseNextPillar(ans) {
  // 未着手の柱を最優先（行動の着火を優先）
  const pillars = [
    { k: "breathing", v: ans.breathing },
    { k: "stretch",   v: ans.stretch },
    { k: "tsubo",     v: ans.tsubo },
    { k: "kampo",     v: ans.kampo },
    { k: "habits",    v: ans.habits },
  ];
  const notStarted = pillars.find(p => (p.v || "") === "未着手");
  if (notStarted) return notStarted.k;

  // 乱れと柱の紐付け
  if (ans.stress >= 3) return "breathing";
  if (ans.meal   >= 3) return (ans.kampo === "未着手" ? "kampo" : "habits");
  if (ans.motion_level >= 3) return (ans.stretch === "未着手" ? "stretch" : "tsubo");
  if (ans.sleep  >= 3) return (ans.breathing === "未着手" ? "breathing" : "habits");

  return "habits";
}

// ===== GPT呼び出し（テキスト） =====
async function callGPTWithFallbackText(systemPrompt, userPrompt) {
  let rsp = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 480
  });
  let text = rsp.choices?.[0]?.message?.content?.trim() || "";

  if (!text) {
    rsp = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 640
    });
    text = rsp.choices?.[0]?.message?.content?.trim() || "";
  }

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

// ===== GPT呼び出し（JSON構造） =====
async function callGPTJson(systemPrompt, userPrompt) {
  let rsp = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 512
  });
  let raw = rsp.choices?.[0]?.message?.content?.trim() || "";

  // 再試行（同モデル）
  if (!raw) {
    rsp = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 640
    });
    raw = rsp.choices?.[0]?.message?.content?.trim() || "";
  }



  if (!raw) return null;

  // 余分な前後テキスト/コードブロックの除去
  try {
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const sliced = raw.slice(jsonStart, jsonEnd + 1);
      return JSON.parse(sliced);
    }
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// ===== メイン：フォローアップコメント生成 =====
/**
 * @param {string} userId - SupabaseのUUID（users.id）
 * @param {object} followupAnswers - 今回の定期チェック回答（保存直後の値を渡す想定）
 * @returns {{
 *   sections?: {lead:string, score_header:string, diff_line:string, keep_doing:string[], next_steps:string[], footer:string},
 *   gptComment: string,
 *   statusMessage: "ok"|"fallback"|"error"|"no-current"
 * }}
 */
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

    // 正規化
    const curN  = normalizeFollowup(followupAnswers || latest);
    const prevN = prev ? normalizeFollowup(prev) : null;

    if (!curN) {
      return {
        gptComment: "今回は記録が見つかりませんでした。もう一度、定期チェックを送ってください。",
        statusMessage: "no-current",
      };
    }

    // スコア＆差分
    const { score, stars } = computeScore(curN);
    const prevScore = prevN ? computeScore(prevN).score : null;
    const delta = prevScore === null ? null : (score - prevScore);

    // header / diffLine（確定値）
    const header = (prevScore === null)
      ? `今週の整いスコア：${score}点 ${stars}`
      : `前回：${prevScore}点 → 今週：${score}点（${delta>0?'+':''}${delta}） ${stars}`;

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

    // ====== JSON構造出力プロンプト ======
    const systemJson = `
あなたは「ととのうAI」。東洋医学の体質ケアに基づく“褒めて伸ばす”フィードバックを、日本語で**有効なJSON**のみ出力します。前後に余計なテキストは書かないこと。
返すJSONスキーマは下記、全フィールド必須：

{
  "lead": "冒頭ひとこと（2〜3文、親しみやすく、絵文字も使って）",
  "score_header": "ヘッダ行（こちらで計算した header をそのまま入れる）",
  "diff_line": "前回比の短評（こちらで渡す diffLine をそのまま入れる）",
  "keep_doing": ["このまま続けると良い点（2〜3項目、文として自然に）"],
  "next_steps": ["次にやってみてほしいこと（1〜2項目、必ず渡された nextStepText を自然な日本語にして含める）"],
  "footer": "締めのひとこと。最後に注意書き（※本サービスは医療行為ではなくセルフケア支援です。）も含める。"
}

制約：
- 全体で全角250〜350字を目安に（リスト項目は短文）
- 「keep_doing」「next_steps」はリストで返す（各要素は記号なしの文章）
- 「score_header」「diff_line」は文字加工せず、そのまま入れる
`.trim();

    const userJson = `
【固定ヘッダ（挿入必須）】
score_header: ${header}
diffLine: ${diffLine}

【主訴】${symptomJapanese}

【今回の定期チェック（正規化後の値）】
Q1: 主訴=${curN.symptom_level}
Q2: 睡眠=${curN.sleep} / 食事=${curN.meal} / ストレス=${curN.stress}
Q3: 習慣=${curN.habits} / 呼吸法=${curN.breathing} / ストレッチ=${curN.stretch} / ツボ=${curN.tsubo} / 漢方薬=${curN.kampo}
Q4: 動作=${curN.motion_level}

【改善点（前回→今回で良化）】${praise.map(p => `${p.label}: ${p.d} 段階改善`).join(" / ") || "（特記事項なし）"}
【課題候補】${bottleneck ? `${bottleneck.label}（スコア${bottleneck.v}）` : "（特記事項なし）"}

【次の一歩（柱と本文）】
pillar: ${pillarLabelMap[nextPillar] || "次の一歩"}
次の一歩テキスト: ${nextStepText}
`.trim();

    // JSON生成
    const sections = await callGPTJson(systemJson, userJson);

    // === 後方互換のため、テキスト版も生成（JSON失敗時の保険にも利用） ===
    const systemText = `
あなたは「ととのうAI」。東洋医学の体質ケアに基づき、定期チェック結果から“褒めて伸ばす”コメントを作ります。
出力は次の形式・条件を厳守してください。

【形式】
1) 冒頭：全体の体調・変化をひと言（親しみやすく、絵文字も使って）
2) 直後に score_header をそのまま1行で記載
3) 見出し「前回比」：diff_line を1行で記載
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

    const userText = `
score_header: ${header}
diff_line: ${diffLine}

【主訴】${symptomJapanese}

【今回の定期チェック】
Q1: 主訴=${curN.symptom_level}
Q2: 睡眠=${curN.sleep} / 食事=${curN.meal} / ストレス=${curN.stress}
Q3: 習慣=${curN.habits} / 呼吸法=${curN.breathing} / ストレッチ=${curN.stretch} / ツボ=${curN.tsubo} / 漢方薬=${curN.kampo}
Q4: 動作=${curN.motion_level}

改善点: ${praise.map(p => `${p.label}: ${p.d} 段階改善`).join(" / ") || "（特記事項なし）"}
課題候補: ${bottleneck ? `${bottleneck.label}（スコア${bottleneck.v}）` : "（特記事項なし）"}
nextStep（本文そのまま含めること）: ${nextStepText}
`.trim();

    let gptComment = await callGPTWithFallbackText(systemText, userText);

    // ===== フォールバック（最終手段：最低限“読む価値のある一枚”） =====
    if (!gptComment) {
      const praiseLine = (praise && praise.length)
        ? `👏このまま続けるといいこと：${praise.map(p => `${p.label}が${p.d}段階よくなっています`).join("・")}。`
        : `👏このまま続けるといいこと：小さな積み重ねができています。`;

      const taskLine = bottleneck
        ? `🧭今週の課題：${bottleneck.label}（スコア${bottleneck.v}）。`
        : `🧭今週の課題：基礎の継続。`;

      const pillarJa = pillarLabelMap[nextPillar] || "次の一歩";
      gptComment =
        `${header}\n` +
        `🔁前回比：${diffLine}\n` +
        `${praiseLine}\n` +
        `${taskLine}\n` +
        `➡️次にやってほしいこと（${pillarJa}）：${nextStepText}\n` +
        `※本サービスは医療行為ではなくセルフケア支援です。`;
      return { sections: null, gptComment, statusMessage: "fallback" };
    }

    // sections があれば、後方互換として gptComment も整形し直す（Flex非対応時でも読めるように）
    if (sections && typeof sections === "object") {
      const {
        lead = "",
        score_header = header,
        diff_line = diffLine,
        keep_doing = [],
        next_steps = [],
        footer = ""
      } = sections;

      const keepLines = keep_doing.map(s => `・${s}`).join("\n");
      const nextLines = next_steps.map(s => `・${s}`).join("\n");

      gptComment =
        `${lead}\n` +
        `${score_header}\n\n` +
        `【前回比】\n${diff_line}\n\n` +
        `【このまま続けるといいこと】\n${keepLines}\n\n` +
        `【次にやってみてほしいこと】\n${nextLines}\n\n` +
        `${footer}`;
      return { sections, gptComment, statusMessage: "ok" };
    }

    // JSON失敗でもテキストはOK
    return { sections: null, gptComment, statusMessage: "ok" };

  } catch (error) {
    console.error("sendFollowupResponse error:", error);
    return {
      sections: null,
      gptComment: "今週のフィードバック生成に失敗しました。時間を置いて再実行してください。",
      statusMessage: "error",
    };
  }
}

module.exports = { sendFollowupResponse };
