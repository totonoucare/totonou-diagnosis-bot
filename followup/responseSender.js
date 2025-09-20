// followup/responseSender.js
// 定期チェック：前回差分＋「褒めて伸ばす」＋点数/星の確定計算（gpt-5）
// JSON構造（sections）を返す：{ lead, score_header, diff_line, keep_doing[], next_steps[], footer }
// contents.advice は jsonb配列（[{header, body}, ...] または {habits,...}）想定
// ※本ファイルは「JSON一本化（フォールバック無し）」版

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
    habits:   pick(["体質改善習慣"]),
    breathing:pick(["呼吸法", "巡りととのう呼吸法"]),
    stretch:  pick(["ストレッチ", "経絡", "けいらく"]),
    tsubo:    pick(["指先・ツボほぐし", "指先", "ツボ"]),
    kampo:    pick(["体質で選ぶオススメ漢方薬", "漢方"]),
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
// ※ Q3は「漢方薬」をスコア計算から除外（careValsに含めない）
const careMap = { "継続": 0, "継続中": 0, "時々": 1, "未着手": 2 };
const isWeak = (v) => v === "未着手" || v === "時々";

function adherencePenalty(ans) {
  let add = 0;
  // 因果：habits ↔ sleep/meal、breathing ↔ stress、stretch/tsubo ↔ motion
  if (ans.sleep >= 3 && isWeak(ans.habits))    add += 1.5;
  if (ans.meal  >= 3 && isWeak(ans.habits))    add += 1.5;
  if (ans.stress>= 3 && isWeak(ans.breathing)) add += 1.5;
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

/** pillarごとの“因果ベース理由文” */
function reasonForPillar(pillarKey) {
  switch (pillarKey) {
    case "habits":
      // habits ↔ sleep/meal/stress
      return "生活の土台を整えると、睡眠・食事・ストレスのバランスが同時に噛み合いはじめます。";
    case "breathing":
      // breathing = stress改善＆自律調整の底上げ
      return "鳩尾下の動きを意識した「巡りととのう呼吸法」は、深層筋活性や自律神経の安定に直結。乱れたストレス反応を鎮め、全体の調整力を底上げします。";
    case "stretch":
      // stretch = motion_levelの直接改善
      return "動きのつらさに直結する経絡ラインのストレッチ。ストレッチで動作の抵抗そのものを直接下げていきます。";
    case "tsubo":
      // tsubo = motion_levelの直接改善
      return "指先ほぐしやツボほぐしは局所と全体の連動を促し、動作のひっかかり（motion_level）を直接和らげます。";
    case "kampo":
      return "他の柱を十分に整えた上で、足りない部分を漢方で補う“最後の一手”です。";
    default:
      return "";
  }
}

/** 次の一歩（どの柱を前面に）：
 * 1) 未着手優先（ただし漢方は最後尾）
 * 2) ボトルネック対応：stress→breathing / meal・sleep→habits / motion→stretch→tsubo
 * 3) 漢方の“最終手段”ゲート：他の柱が弱くなく、かつ score<80 のときだけ許可
 */
function chooseNextPillar(ans, score) {
  const weak = (v) => v === "未着手" || v === "時々";

  // 1) 未着手優先（kampoは最後に評価）
  const notStartedOrder = ["breathing", "stretch", "tsubo", "habits", "kampo"];
  const firstNotStarted = notStartedOrder.find(k => weak(ans[k]));
  if (firstNotStarted && firstNotStarted !== "kampo") {
    return firstNotStarted;
  }

  // 2) ボトルネックに基づく優先度
  if (ans.stress >= 3 && weak(ans.breathing)) return "breathing";
  if (ans.motion_level >= 3) {
    if (weak(ans.stretch)) return "stretch";
    if (weak(ans.tsubo))   return "tsubo";
  }
  if (ans.meal >= 3 || ans.sleep >= 3) {
    if (weak(ans.habits))     return "habits";
    if (weak(ans.breathing))  return "breathing";
    if (weak(ans.stretch))    return "stretch";
    if (weak(ans.tsubo))      return "tsubo";
  }

  // 3) ここまでで候補が無い＝他の柱はある程度やれている
  //    → スコアが低い間（<80）のみ、初めて漢方を候補に
  const othersOk =
    !weak(ans.habits) && !weak(ans.breathing) && !weak(ans.stretch) && !weak(ans.tsubo);

  if (othersOk && score < 80 && weak(ans.kampo)) {
    return "kampo";
  }

  // 特に乱れが目立たず、未着手もない → 土台強化の habits をデフォルト
  return "habits";
}

// ===== GPT呼び出し（JSON構造：GPT-4o） =====
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
    if (!raw) return null;

    // ```json ... ``` に包まれている場合を除去
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    }

    try {
      return JSON.parse(raw);
    } catch {
      const s = raw.indexOf("{");
      const e = raw.lastIndexOf("}");
      if (s >= 0 && e > s) {
        try { return JSON.parse(raw.slice(s, e + 1)); } catch { /* noop */ }
      }
      return null;
    }
  } catch (err) {
    console.error("callGPTJson error:", err);
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
 *   statusMessage: "ok"|"error"|"no-current"
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

    // 改善点・課題・pillar決定
    const praise = prevN ? pickPraise(prevN, curN) : [];
    const bottleneck = pickBottleneck(curN);
    const praiseTxt = praise.length ? praise.map(p=>`${p.label}が改善`).join("・") : null;
    const bottleneckTxt = bottleneck ? `特に「${bottleneck.label}」の負担が目立ちます。` : "";

    const diffLine =
      prevScore === null ? "今回が初回のチェックです。次回から変化を追えます。"
      : delta > 0        ? `前回より +${delta} 点の改善です。${praiseTxt ? praiseTxt+" が良くなっています。" : ""}`
      : delta < 0        ? `前回より ${delta} 点の低下です。${bottleneckTxt || "無理なく一箇所だけ整え直しましょう。"}`
                         : "前回と同じスコア（現状維持）です。小さな積み重ねを続けましょう。";

    // 次の一歩（“漢方は最終手段” ルール込み）
    const nextPillar = chooseNextPillar(curN, score);

    // nextStep テキスト：因果の理由を前置きし、必要なら抜粋・補足
    const base = (adviceObj[nextPillar] && String(adviceObj[nextPillar]).trim()) || "";
    const reason = reasonForPillar(nextPillar);
    const softHint = bottleneck ? `今は「${bottleneck.label}」にフォーカスするとラクになります。` : "";
    const nextStepText =
      base
        ? `今回の課題は「${pillarLabelMap[nextPillar]}」。${reason}${softHint ? " " + softHint : ""} 次のケア案：${base}`
        : `今回は「${pillarLabelMap[nextPillar]}」を少しだけ。${reason}${softHint ? " " + softHint : ""}`;

    // ====== JSON構造出力プロンプト ======
    const systemJson = `
あなたは「ととのうAI」。東洋医学の体質ケアに基づく“褒めて伸ばす”フィードバックを、日本語で**有効なJSON**のみ出力します。前後に余計なテキストは書かないこと。
返すJSONスキーマは下記、全フィールド必須：

{
  "lead": "冒頭ひとこと（2〜3文、親しみやすく、絵文字も使って）",
  "score_header": "ヘッダ行（こちらで計算した header をそのまま入れる）",
  "diff_line": "前回比の短評（こちらで渡す diffLine をそのまま入れる）",
  "keep_doing": ["このまま続けると良い点（2〜3項目、文として自然に）。なぜ良いか因果も一言添える"],
  "next_steps": ["次にやってみてほしいこと（1〜2項目、必ず渡した nextStepText を自然な日本語にして含める。因果の理由も添える）"],
  "footer": "締めのひとこと。最後に注意書き（※本サービスは医療行為ではなくセルフケア支援です。）も含める。"
}

制約：
- 全体で全角250〜350字を目安に（リスト項目は短文）
- 「score_header」「diff_line」は文字加工せず、そのまま入れる
- 「keep_doing」「next_steps」はリストで返す（各要素は記号なしの文章）
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

    const sections = await callGPTJson(systemJson, userJson);
    if (!sections) {
      // JSON一本化のため失敗時も固定メッセージで返す（API不調時の最低限）
      return {
        sections: null,
        gptComment: "現在フィードバックの生成に問題が発生しています。しばらくしてからもう一度お試しください。",
        statusMessage: "error",
      };
    }

    // JSON一本化だが、互換のため gptComment も簡易生成（Flex非対応時でも読めるように）
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

    const gptComment =
      `${lead}\n` +
      `${score_header}\n\n` +
      `【前回比】\n${diff_line}\n\n` +
      `【このまま続けるといいこと】\n${keepLines}\n\n` +
      `【次にやってみてほしいこと】\n${nextLines}\n\n` +
      `${footer}`;

    return { sections, gptComment, statusMessage: "ok" };

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
