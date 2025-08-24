// followup/responseSender.js
// 定期チェック：前回差分＋「褒めて伸ばす」＋スコア/星の確定計算（gpt-5）
// 出力は「テキスト版」＋「3カード分割JSON」を返す（ルーター後方互換）
// gpt-5 は max_completion_tokens 指定、temperature は未指定（=デフォルト）
//
// 依存：supabaseMemoryManager.getLastTwoFollowupsByUserId(userId)
//       supabaseMemoryManager.getContext(lineId)
//       supabaseMemoryManager.getSubscribedUsers()

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

/**
 * contents.advice（jsonb配列 or オブジェクト）→ 5本柱テキストへマッピング
 */
function readAdvice(adviceInput) {
  if (!adviceInput) {
    return { habits: "", breathing: "", stretch: "", tsubo: "", kampo: "" };
  }
  // 既に {habits,breathing,...} オブジェクトならそのまま
  if (!Array.isArray(adviceInput) && typeof adviceInput === "object") {
    const { habits = "", breathing = "", stretch = "", tsubo = "", kampo = "" } = adviceInput;
    return { habits, breathing, stretch, tsubo, kampo };
  }
  // [{header, body}, ...] 形式
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

// ===== スコア算定（0〜100）＋星（1〜5） =====

// Q3の文字→数値
const careMap = { "継続": 0, "継続中": 0, "時々": 1, "未着手": 2 };
// “未着手/時々” 判定
const isWeak = (v) => v === "未着手" || v === "時々";

/**
 * contents.advice と照合した “アドヒアランス修正”減点（※漢方は減点しない）
 * - Q2: 睡眠/食事/ストレスの乱れ × （習慣/呼吸の未導入）
 * - Q4: 動作が重い × （ストレッチ/ツボの未導入）
 */
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

/**
 * 減点法：Q1(35%) + Q2(35%) + Q3(20%) + Q4(10%) + アドヒアランス修正
 * ※ 入力は followup レコードの1件（最新 or 前回）
 */
function computeScore(ans) {
  let penalty = 0;

  // Q1 主訴/全体（最大35点）
  penalty += ((ans.symptom_level - 1) + (ans.general_level - 1)) * 3.5;

  // Q2 睡眠/食事/ストレス（最大35点）
  penalty += ((ans.sleep - 1) + (ans.meal - 1) + (ans.stress - 1)) * 2.333;

  // Q3 セルフケア（最大20点）※漢方は減点対象から除外
  const careVals = [ans.habits, ans.breathing, ans.stretch, ans.tsubo];
  const careScore = careVals.reduce((acc, v) => acc + (careMap[v] ?? 0), 0);
  penalty += careScore * 2;

  // Q4 動作（最大10点）
  penalty += (ans.motion_level - 1) * 2.5;

  // アドヒアランス修正（+0〜約6点）
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

// ===== 次の一歩：5本柱のうちどれを前面に出すか =====
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

  // 乱れと柱の紐付け（ストレス→呼吸 / 食事→習慣 or 漢方 / 動作→スト or ツボ / 睡眠→呼吸 or 習慣）
  if (ans.stress >= 3) return "breathing";
  if (ans.meal   >= 3) return (ans.kampo === "未着手" ? "kampo" : "habits");
  if (ans.motion_level >= 3) return (ans.stretch === "未着手" ? "stretch" : "tsubo");
  if (ans.sleep  >= 3) return (ans.breathing === "未着手" ? "breathing" : "habits");

  // 大きな乱れがない場合は習慣を微増
  return "habits";
}

/**
 * GPTに投げてカード分割JSONを生成（gpt-5）—空返し対策で再試行＋代替モデル
 * 期待するJSON:
 * { "card1": "...", "card2": "...", "card3": "..." }
 */
async function callGPTCards(systemPrompt, userPrompt) {
  // helper: 一度叩いてJSON取り出し
  async function oneShot(model, maxTokens) {
    const rsp = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: maxTokens
    });
    const txt = rsp.choices?.[0]?.message?.content?.trim() || "";
    return txt;
  }

  // 1st try (gpt-5)
  let raw = await oneShot("gpt-5", 640);

  // retry same (gpt-5)
  if (!raw) raw = await oneShot("gpt-5", 800);

  // alternative (gpt-4.1-mini)
  if (!raw) raw = await oneShot("gpt-4.1-mini", 640);

  return raw || "";
}

// JSON抽出（フェンス/前後ノイズに耐性）
function safeParseCards(text) {
  if (!text) return null;
  // コードフェンス内JSON優先
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const body = fence ? fence[1] : text;
  try {
    const obj = JSON.parse(body);
    if (obj && typeof obj === "object" && obj.card1 && obj.card2 && obj.card3) {
      return { card1: String(obj.card1), card2: String(obj.card2), card3: String(obj.card3) };
    }
  } catch(e) { /* fallthrough */ }
  return null;
}

// ===== メイン：フォローアップコメント生成 =====
/**
 * @param {string} userId - SupabaseのUUID（users.id）
 * @param {object} followupAnswers - 今回の定期チェック回答（保存直後の値を渡す想定）
 * @returns {{gptComment: string, statusMessage: "ok"|"fallback"|"error"|"no-current", cards?: {card1:string,card2:string,card3:string, header:string, score:number, prevScore:number|null, delta:number|null, stars:string}}}
 */
async function sendFollowupResponse(userId, followupAnswers) {
  try {
    // userId → lineId（context取得用）
    const users = await supabaseMemoryManager.getSubscribedUsers();
    const user = users.find((u) => u.id === userId);
    if (!user || !user.line_id) {
      throw new Error(`userId=${userId} に対応する line_id が見つかりません`);
    }
    const lineId = user.line_id;

    // 体質ケアの context（contents.advice を含む）取得
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

    // 直近2件の followups（今回 vs 前回）
    const { latest, prev } = await supabaseMemoryManager.getLastTwoFollowupsByUserId(userId);
    // cur は引数（保存直後の今回）を優先、それがなければDB最新
    const cur = followupAnswers || latest;
    if (!cur) {
      return {
        gptComment: "今回は記録が見つかりませんでした。もう一度、定期チェックを送ってください。",
        statusMessage: "no-current",
      };
    }

    // スコア＆差分（※ cur/prev の Q3 文字状態をそのまま使う）
    const { score, stars, starsNum } = computeScore(cur);
    const prevScore = prev ? computeScore(prev).score : null;
    const delta = prevScore === null ? null : (score - prevScore);

    // 改善点・課題・次の一歩
    const praise = prev ? pickPraise(prev, cur) : [];
    const bottleneck = pickBottleneck(cur);
    const nextPillar = chooseNextPillar(cur);
    const nextStepText = adviceObj[nextPillar] && String(adviceObj[nextPillar]).trim()
      ? String(adviceObj[nextPillar]).trim()
      : "今日は1分だけでも、自分のケア時間を作ってみましょう。呼吸をゆっくり、心地よく。";

    // ヘッダ（点・差分・星は確定値として固定）
    const header =
      (prevScore === null)
        ? `今週の整いスコア：${score}点 ${stars}`
        : (delta === 0)
          ? `前回：${prevScore}点 → 今週：${score}点（±0） ${stars}`
          : `前回：${prevScore}点 → 今週：${score}点（${delta>0?'+':''}${delta}） ${stars}`;

    // ===== GPT プロンプト（3カードJSONを返す） =====
    const systemPrompt = `
あなたは「ととのうAI」。東洋医学の体質ケアに基づき、定期チェック結果から“褒めて伸ばす”コメントを作ります。
出力は必ず JSON で、以下の3カードに分割してください。

- カード①（結果概要）：冒頭の励まし1文＋「header」をそのまま1行で載せる＋差分の短評1文
- カード②（このまま続けるといいこと）：承認ポイントを2〜3点。絵文字OK。短く具体的に。
- カード③（次にやってみてほしいこと）：nextStep（与えられる本文）を必ず含める。1〜2点の具体提案。最後に注意書き「※本サービスは医療行為ではなくセルフケア支援です。」を入れる。

【厳守】
- 必ず以下の JSON だけを返すこと（前後の説明文やコードフェンスは禁止）：
{"card1":"...","card2":"...","card3":"..."}
- 文字数目安：各カード 全角120〜220字
- nextStep は意味改変しない（言い換え可）
- 専門用語は簡潔に（初心者にも分かる語彙）
`.trim();

    const userPrompt = `
【header】
${header}

【主訴】${symptomJapanese}

【今回の定期チェック】
Q1: 主訴=${cur.symptom_level} / 全体=${cur.general_level}
Q2: 睡眠=${cur.sleep} / 食事=${cur.meal} / ストレス=${cur.stress}
Q3: 習慣=${cur.habits} / 呼吸法=${cur.breathing} / ストレッチ=${cur.stretch} / ツボ=${cur.tsubo} / 漢方薬=${cur.kampo}
Q4: 動作=${cur.motion_level}
Q5: 困りごと=${cur.q5_answer || "未入力"}

【改善点（前回→今回で良化）】
${praise.map(p => `${p.label}: ${p.d} 段階改善`).join(" / ") || "（特記事項なし）"}

【課題候補】
${bottleneck ? `${bottleneck.label}（スコア${bottleneck.v}）` : "（特記事項なし）"}

【次の一歩（柱と本文）】
pillar: ${pillarLabelMap[nextPillar] || "次の一歩"}
nextStep: ${nextStepText}
`.trim();

    // GPT呼び出し（3カードJSON）
    let raw = await callGPTCards(systemPrompt, userPrompt);
    let cards = safeParseCards(raw);

    // ===== フォールバック：最低限“読む価値のある一枚”を保証 =====
    if (!cards) {
      const praiseLine = (praise && praise.length)
        ? `👏このまま続けるといいこと：${praise.map(p => `${p.label}が${p.d}段階よくなっています`).join("・")}。`
        : `👏このまま続けるといいこと：小さな積み重ねができています。`;

      const taskLine = bottleneck
        ? `🧭今週の課題：${bottleneck.label}（スコア${bottleneck.v}）。`
        : `🧭今週の課題：基礎の継続。`;

      const pillarJa = pillarLabelMap[nextPillar] || "次の一歩";
      const fallback = {
        card1: `調子を丁寧に整えられていますね。\n${header}\n前回との差分を意識しながら、今週も安定を続けましょう。`,
        card2: `${praiseLine}`,
        card3: `➡️次にやってほしいこと（${pillarJa}）：${nextStepText}\n※本サービスは医療行為ではなくセルフケア支援です。`
      };

      const mergedText =
        `📋【今回の定期チェックナビ】\n\n` +
        `${fallback.card1}\n\n${fallback.card2}\n\n${fallback.card3}`;

      return {
        gptComment: mergedText,
        statusMessage: "fallback",
        cards: { ...fallback, header, score, prevScore, delta, stars }
      };
    }

    // テキスト版も連結して返す（後方互換）
    const mergedText =
      `📋【今回の定期チェックナビ】\n\n` +
      `${cards.card1}\n\n${cards.card2}\n\n${cards.card3}`;

    return {
      gptComment: mergedText,
      statusMessage: "ok",
      cards: { ...cards, header, score, prevScore, delta, stars }
    };

  } catch (error) {
    console.error("sendFollowupResponse error:", error);
    return {
      gptComment: "今週のフィードバック生成に失敗しました。時間を置いて再実行してください。",
      statusMessage: "error",
    };
  }
}

module.exports = { sendFollowupResponse };
