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
    // Q1
    symptom_level: n(ans.symptom_level, 3),
    // Q2
    sleep:  n(ans.sleep, 3),
    meal:   n(ans.meal, 3),
    stress: n(ans.stress, 3),
    // Q3
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
const isActive = (v) => v === "継続" || v === "継続中";

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

/** 減点法：Q1(35%) + Q2(35%) + Q3(20%) + Q4(10%) + アドヒアランス修正 */
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
    { key: "symptom_level", label: "不調レベル",     d: prev.symptom_level - cur.symptom_level },
    { key: "sleep",         label: "睡眠",     d: prev.sleep - cur.sleep },
    { key: "meal",          label: "食事",     d: prev.meal - cur.meal },
    { key: "stress",        label: "ストレス", d: prev.stress - cur.stress },
    { key: "motion_level",  label: "動作テスト",     d: prev.motion_level - cur.motion_level },
  ];
  return diffs.filter(x => x.d > 0).sort((a,b) => b.d - a.d).slice(0, 3); // 3件まで拾う
}

// ===== ボトルネック（今回値が高い=乱れ） =====
function pickBottleneck(cur) {
  const arr = [
    { key: "meal",         label: "食事",     v: cur.meal },
    { key: "sleep",        label: "睡眠",     v: cur.sleep },
    { key: "stress",       label: "ストレス", v: cur.stress },
    { key: "motion_level", label: "動作テスト",     v: cur.motion_level },
  ];
  return arr.filter(c => c.v >= 3).sort((a,b) => b.v - a.v)[0] || null;
}

/** pillarごとの“因果ベース理由文”（motion＝経絡ライン由来を明示） */
function reasonForPillar(pillarKey) {
  switch (pillarKey) {
    case "habits":
      // habits ↔ sleep/meal/stress（3要素セットを強調）
      return "生活の土台づくり（睡眠・食事・活動習慣）をまとめて整えると、全体のバランスが噛み合いはじめます。";
    case "breathing":
      // breathing = stress改善＆自律調整の底上げ
      return "鳩尾下の動きを意識した「巡りととのう呼吸法」は、内臓に近い筋肉を活性化し自律神経に働きかけるとともに、体の構造的な調整力を底上げします。";
    case "stretch":
      // stretch = その動作で張る経絡ラインを伸ばす → motion_levelを直接改善
      return "“今いちばん張りを感じる動作”で伸展される経絡ラインのひっかかりをストレッチで直接伸ばし経絡の通りをよくすることで、関連する内臓の負担軽減や体がラクに動ける状態キープにつながります。";
    case "tsubo":
      // tsubo = その経絡ライン上の井穴・要穴をほぐす → motion_levelを直接改善
      return "その動作で張りを感じる経絡ライン上の井穴(指先)や重要穴を、指先からやさしくほぐします。ライン全体の滞りがほどけ、関連する内臓の負担軽減や体がラクに動ける状態キープにつながります。";
    case "kampo":
      return "他の柱を十分に整えた上で、足りない部分を漢方で補う“最後の一手”です。";
    default:
      return "";
  }
}

/** keep_doing 候補を pillar × 改善差分 から自動生成（最大3件）
 *  motion_level 改善時は「その動作で張る経絡ライン」→ stretch/tsubo の因果を明示
 */
function buildKeepDoing(cur, prev, score) {
  const items = [];
  const diffs = prev ? {
    sleep:        prev.sleep        - cur.sleep,
    meal:         prev.meal         - cur.meal,
    stress:       prev.stress       - cur.stress,
    motion_level: prev.motion_level - cur.motion_level,
    symptom:      prev.symptom_level- cur.symptom_level,
  } : null;

  // 1) 差分に紐づく pillar 因果（改善が大きい順）
  const sortedKeys = diffs
    ? Object.entries(diffs).sort((a,b) => b[1]-a[1]).map(([k])=>k).filter(k => diffs[k] > 0)
    : [];

  for (const k of sortedKeys) {
    if (items.length >= 3) break;

    if (k === "stress" && isActive(cur.breathing)) {
      items.push("呼吸法の継続がストレスの落ち着きに表れています。1〜2分でも続ける価値あり。");
      continue;
    }
    if (k === "sleep" && isActive(cur.habits)) {
      items.push("体質改善習慣の継続が睡眠の整いに反映されています。土台づくりをこの調子で。");
      continue;
    }
    if (k === "meal" && isActive(cur.habits)) {
      items.push("体質改善習慣を続けたことで、食の乱れに引きずられにくくなっています。");
      continue;
    }
    if (k === "motion_level" && (isActive(cur.stretch) || isActive(cur.tsubo))) {
      const which = isActive(cur.stretch) ? "ストレッチ" : "ツボほぐし";
      items.push(`${which}の継続が「その動作で張りを感じる経絡ライン」の通りを良くし、関連する内臓の負担軽減や体がラクに動ける状態キープにつながっています。`);
      continue;
    }
    if (k === "symptom" && (isActive(cur.habits) || isActive(cur.breathing))) {
      const base = isActive(cur.habits) ? "生活の土台づくり" : "呼吸の整え";
      items.push(`${base}が主訴の軽減にも波及しています。良い流れを保ちましょう。`);
      continue;
    }
  }

  // 2) 差分が少なくても、現在の pillar 継続を因果で承認（優先：habits→breathing→stretch/tsubo）
  if (items.length < 2) {
    if (isActive(cur.habits)) items.push("体質改善習慣の継続は睡眠・食事・ストレスの土台づくりに直結しています。");
    if (items.length < 3 && isActive(cur.breathing)) items.push("呼吸法の継続は自律神経の安定を支え、日中の過ごしやすさに効いてきます。");
    if (items.length < 3 && (isActive(cur.stretch) || isActive(cur.tsubo))) {
      const which = isActive(cur.stretch) ? "ストレッチ" : "ツボほぐし";
      items.push(`${which}の継続は「その動作で張る経絡ライン」を整え、ラクに動ける状態を保ちます。`);
    }
  }

  // 3) 漢方は“最終手段”：他柱が概ねできていてスコア<80、かつ継続時のみ控えめに承認（枠が余っていれば）
  const othersOk = isActive(cur.habits) && isActive(cur.breathing) && (isActive(cur.stretch) || isActive(cur.tsubo));
  if (items.length < 3 && othersOk && score < 80 && isActive(cur.kampo)) {
    items.push("漢方は補助として良い使い方ができています。主軸は生活・呼吸・動きの継続で。");
  }

  return items.slice(0, 3);
}

/** 次の一歩（どの柱を前面に）：
 * 1) 未着手優先（ただし漢方は最後尾）
 * 2) ボトルネック対応：meal/sleep→habits、stress→breathing、motion→stretch→tsubo
 * 3) 漢方の“最終手段”ゲート：他の柱が弱くなく、かつ score<80 のときだけ許可
 */
function chooseNextPillar(ans, score) {
  const weak = (v) => v === "未着手" || v === "時々";

  // 1) 未着手優先（kampoは最後に評価）※順序を habits → breathing → stretch → tsubo → kampo に変更
  const notStartedOrder = ["habits", "breathing", "stretch", "tsubo", "kampo"];
  const firstNotStarted = notStartedOrder.find(k => weak(ans[k]));
  if (firstNotStarted && firstNotStarted !== "kampo") {
    return firstNotStarted;
  }

  // 2) ボトルネックに基づく優先度
  // a) meal/sleep 高め → habits 最優先
  if ((ans.meal >= 3 || ans.sleep >= 3) && weak(ans.habits)) {
    return "habits";
  }
  // b) stress 高め → breathing
  if (ans.stress >= 3 && weak(ans.breathing)) {
    return "breathing";
  }
  // c) motion 高め → stretch → tsubo
  if (ans.motion_level >= 3) {
    if (weak(ans.stretch)) return "stretch";
    if (weak(ans.tsubo))   return "tsubo";
  }
  // d) meal/sleep 高いが habits は既にある程度できている → 次候補へ
  if ((ans.meal >= 3 || ans.sleep >= 3)) {
    if (weak(ans.breathing)) return "breathing";
    if (weak(ans.stretch))   return "stretch";
    if (weak(ans.tsubo))     return "tsubo";
  }

  // 3) 他が概ねできていて score<80 → kampo（最終手段）
  const othersOk =
    !isWeak(ans.habits) && !isWeak(ans.breathing) && !isWeak(ans.stretch) && !isWeak(ans.tsubo);
  if (othersOk && score < 80 && isWeak(ans.kampo)) {
    return "kampo";
  }

  // 4) デフォルトは土台強化（habits）
  return "habits";
}

// ===== GPT呼び出し（JSON構造：GPT-5 / Responses API） =====
async function callGPTJson(systemPrompt, userPrompt) {
  try {
    // 1発目：生成キック
    const rsp = await openai.responses.create({
      model: "gpt-5",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt  },
      ],
      // 速度と安定のバランス：長文化を避ける
      reasoning: { effort: "low" },
      text: { verbosity: "medium" },
      // max_output_tokens は付けない（途中切れ防止）
    });

    // 生成完了待ち（短ポーリング）：output_text が空なケースの保険
    let out = rsp;
    let rawText =
      out.output_text ||
      (out.output?.[0]?.content?.map(c => c?.text || "").join("\n").trim()) ||
      "";

    const started = Date.now();
    while (!rawText && out?.status !== "failed" && Date.now() - started < 8000) {
      await new Promise(r => setTimeout(r, 500));
      out = await openai.responses.retrieve(out.id);
      rawText =
        out.output_text ||
        (out.output?.[0]?.content?.map(c => c?.text || "").join("\n").trim()) ||
        "";
    }

    if (!rawText) return null;

    // ```json ... ``` で返る場合の除去
    const cleaned = rawText.startsWith("```")
      ? rawText.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim()
      : rawText.trim();

    // JSONパース（壊れてても {..} 最外を拾う）
    try {
      return JSON.parse(cleaned);
    } catch {
      const s = cleaned.indexOf("{");
      const e = cleaned.lastIndexOf("}");
      if (s >= 0 && e > s) {
        try { return JSON.parse(cleaned.slice(s, e + 1)); } catch { /* noop */ }
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

    // 次の一歩（“漢方は最終手段” ルール込み）※新しい順序で選定
    const nextPillar = chooseNextPillar(curN, score);

    // nextStep テキスト：因果の理由を前置きし、必要なら抜粋・補足
    const base = (adviceObj[nextPillar] && String(adviceObj[nextPillar]).trim()) || "";
    const reason = reasonForPillar(nextPillar);
    const softHint = bottleneck ? `今は「${bottleneck.label}」にフォーカスするとラクになります。` : "";
    const nextStepText =
      base
        ? `今回の課題は「${pillarLabelMap[nextPillar]}」。${reason}${softHint ? " " + softHint : ""} 次のケア案：${base}`
        : `今回は「${pillarLabelMap[nextPillar]}」を少しだけ。${reason}${softHint ? " " + softHint : ""}`;

    // keep_doing 候補（pillar × 差分の因果承認）を生成
    const keepDoingHints = buildKeepDoing(curN, prevN, score);

    // ====== JSON構造出力プロンプト ======
    const systemJson = `
あなたは「ととのうAI」。東洋医学の体質ケアに基づく“褒めて伸ばす”フィードバックを、日本語で**有効なJSON**のみ出力します。前後に余計なテキストは書かないこと。
返すJSONスキーマは下記、全フィールド必須：

{
  "lead": "冒頭ひとこと（2〜3文、親しみやすく、絵文字も使って）",
  "score_header": "ヘッダ行（こちらで計算した header をそのまま入れる）",
  "diff_line": "前回比の短評（こちらで渡す diffLine をそのまま入れる）",
  "keep_doing": ["このまま続けると良い点（基本2項目、内容が明確に異なる場合のみ3項目）。与えられた keep_doing候補 を必ず参照し、意味が重複・近似する内容は1つに『統合要約』して出す。pillar名（例：呼吸法・体質改善習慣・ストレッチ・ツボ）と因果（何に効いているか）を残す。視点が被らないよう、原因（行動）／効果（結果）／体感（ユーザー利益）を取り混ぜて簡潔に。語尾や主語の反復は避け、冗長表現を削る。"],
  "next_steps": ["次に取り組むと良いこと（基本1〜2項目、内容が明確に異なる場合のみ最大3項目）。与えられた nextStepText を必ず参照し、意味が重複・近似する内容は統合して出す。pillar名（呼吸法・習慣・ストレッチ・ツボ・漢方など）と因果（何を改善するためか）を残す。行動は具体的かつシンプルに。冗長表現や似た言い回しの重複は禁止。"]
  "footer": "締めのひとこと。最後に注意書き（※本サービスは医療行為ではなくセルフケア支援です。）も含める。"
}

制約：
- 全体で全角250〜350字を目安に（リスト項目は短文）。keep_doing は基本2件（最大3件）。似た内容は必ず統合し、同じ観点の重複は禁止。
- 「score_header」「diff_line」は文字加工せず、そのまま入れる
- 「keep_doing」「next_steps」はリストで返す（各要素は記号なしの文章）
- keep_doing は与えた候補の範囲で**統合・要約**して作る（新規内容の追加は不可、ただし冗長な重複は統合して1つにまとめる）
- **pillar が「体質改善習慣」の場合、睡眠・食事・活動習慣の3要素に必ず触れること**
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

【keep_doing候補（必ずこの中から2〜3件を選び、言い換え可・意味改変不可）】
${keepDoingHints.map(s => `- ${s}`).join("\n")}
`.trim();

    const sections = await callGPTJson(systemJson, userJson);
    if (!sections) {
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
