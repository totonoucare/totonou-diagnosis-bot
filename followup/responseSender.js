// followup/responseSender.js
// 定期チェック：前回差分＋「褒めて伸ばす」コメント生成（GPT-5）
// contents.advice は 5つのセルフケア項目をまとめた「単一テキスト」を参照する前提

const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 主訴ラベル（既存踏襲）
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

// 5本柱の日本語ラベル（見出し用：内部キーは使わない）
const pillarLabelMap = {
  habits:   "体質改善習慣",
  breathing:"呼吸法",
  stretch:  "ストレッチ",
  tsubo:    "ツボ",
  kampo:    "漢方薬",
};

// ---------- スコア計算 ----------
function computeScore(ans) {
  let penalty = 0;
  // Q1（主訴/全体）重み 0.35
  penalty += ((ans.symptom_level - 1) + (ans.general_level - 1)) * 3.5;
  // Q2（睡眠/食事/ストレス）重み 0.35
  penalty += ((ans.sleep - 1) + (ans.meal - 1) + (ans.stress - 1)) * 2.333;
  // Q3（セルフケア）重み 0.2
  const map = { "継続": 0, "継続中": 0, "時々": 1, "未着手": 2 };
  const careVals = [ans.habits, ans.breathing, ans.stretch, ans.tsubo, ans.kampo];
  const careScore = careVals.reduce((acc, v) => acc + (map[v] ?? 0), 0);
  penalty += careScore * 2;
  // Q4（動作）重み 0.1
  penalty += (ans.motion_level - 1) * 2.5;

  const raw = 100 - penalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const stars = Math.max(1, Math.min(5, Math.ceil(score / 20)));
  return { score, stars };
}

// ---------- 改善点（前回→今回で下がった＝改善） ----------
function pickPraise(prev, cur) {
  if (!prev) return [];
  const diffs = [
    { key: "symptom_level", label: "主訴", d: prev.symptom_level - cur.symptom_level },
    { key: "sleep",         label: "睡眠", d: prev.sleep - cur.sleep },
    { key: "meal",          label: "食事", d: prev.meal - cur.meal },
    { key: "stress",        label: "ストレス", d: prev.stress - cur.stress },
    { key: "motion_level",  label: "動作", d: prev.motion_level - cur.motion_level },
  ];
  return diffs.filter(x => x.d > 0).sort((a,b) => b.d - a.d).slice(0, 2);
}

// ---------- ボトルネック（数値が高い＝乱れ） ----------
function pickBottleneck(cur) {
  const arr = [
    { key: "meal",         label: "食事",     v: cur.meal },
    { key: "sleep",        label: "睡眠",     v: cur.sleep },
    { key: "stress",       label: "ストレス", v: cur.stress },
    { key: "motion_level", label: "動作",     v: cur.motion_level },
  ];
  return arr.filter(c => c.v >= 3).sort((a,b) => b.v - a.v)[0] || null;
}

// ---------- 次の一歩：どの柱を前面に出すか（見出し目的） ----------
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

// ---------- メイン ----------
/**
 * @param {string} userId - SupabaseのUUID（users.id）
 * @param {object} followupAnswers - 今回の定期チェック回答（保存直後の値を渡す）
 * @returns {{ gptComment: string, statusMessage: "ok"|"fallback"|"no-current"|"error" }}
 */
async function sendFollowupResponse(userId, followupAnswers) {
  try {
    // userId→lineId（既存の getContext 用に必要）
    const users = await supabaseMemoryManager.getSubscribedUsers();
    const user = users.find((u) => u.id === userId);
    if (!user || !user.line_id) {
      throw new Error(`userId=${userId} に対応する line_id が見つかりません`);
    }
    const lineId = user.line_id;

    // 初回診断時の context（contents.advice は5本柱がまとまった単一テキスト前提）
    const context = await supabaseMemoryManager.getContext(lineId);
    if (!context) {
      return {
        gptComment: "初回の体質ケアガイドが見つかりませんでした。もう一度、最初の体質診断から実施してください。",
        statusMessage: "no-current",
      };
    }
    const { advice: adviceTextRaw, symptom } = context;

    // advice は単一テキスト想定。配列/オブジェクトで来た場合は結合して1テキストに寄せる保険。
    let adviceText = "";
    if (typeof adviceTextRaw === "string") {
      adviceText = adviceTextRaw;
    } else if (Array.isArray(adviceTextRaw)) {
      // {header, body}配列などは body を結合
      adviceText = adviceTextRaw.map(x => (x?.body ?? "")).filter(Boolean).join("\n\n");
    } else if (adviceTextRaw && typeof adviceTextRaw === "object") {
      // {habits, breathing, ...} などは値を結合
      adviceText = Object.values(adviceTextRaw).filter(Boolean).join("\n\n");
    } else {
      adviceText = "";
    }

    // 直近2件（今回 vs 前回）
    const { latest, prev } = await supabaseMemoryManager.getLastTwoFollowupsByUserId(userId);
    const cur = followupAnswers || latest;
    if (!cur) {
      return {
        gptComment: "今回は記録が見つかりませんでした。もう一度、定期チェックを送ってください。",
        statusMessage: "no-current",
      };
    }

    // スコア＆差分
    const { score, stars } = computeScore(cur);
    const prevScore = prev ? computeScore(prev).score : null;
    const delta = prevScore === null ? null : (score - prevScore);

    // 改善点・課題・次の一歩（柱は見出し用に決めるだけ。本文は adviceText から抽出）
    const praise = prev ? pickPraise(prev, cur) : [];
    const bottleneck = pickBottleneck(cur);
    const nextPillar = chooseNextPillar(cur);
    const pillarJa = pillarLabelMap[nextPillar] || "次の一歩";

    // ヘッダ（点と星、差分表記）
    const starText = "★".repeat(stars) + "☆".repeat(5 - stars);
    const header = delta === null || delta === 0
      ? `今週の整いスコア：${score}点 ${starText}`
      : `今週の整いスコア：${score}点（${delta>0?'+':''}${delta}） ${starText}`;

    const symptomJapanese = symptomMap[symptom] || symptom || "未登録";

    // ===== GPT プロンプト =====
    const systemPrompt = `
あなたは「ととのうAI」。東洋医学の体質ケアガイド（単一テキスト）を参照しつつ、
定期チェック（今回と前回の差分）を読み取り、「褒めて伸ばす」コメントを出力します。

【厳守フォーマット】
1) 冒頭：全体の体調・変化をひと言（親しみやすく / 絵文字OK）
2) 次の行にヘッダ「今週の整いスコア：XX点（±YY） ★★★☆☆」をそのまま載せる
3) 見出し「このまま続けるといいこと」：2〜3点（具体承認、差分や行動を根拠に）
4) 見出し「次にやってみてほしいこと（{pillarJa}）」：1〜2点
   - {adviceText} から意味を変えずに抽出/要約して指示化（言い換え可）
   - bottleneck があればそれに関連する一歩を優先
5) 締めのひとこと（前向き）
6) 最下行に注意書き：「※本サービスは医療行為ではなくセルフケア支援です。」

【文字数】全角250〜350字
【禁止】専門過多・長文化・脅し表現
    `.trim();

    const userPrompt = `
【ヘッダ】
${header}

【主訴】${symptomJapanese}

【今回の定期チェック】
Q1 主訴=${cur.symptom_level} / 全体=${cur.general_level}
Q2 睡眠=${cur.sleep} / 食事=${cur.meal} / ストレス=${cur.stress}
Q3 習慣=${cur.habits} / 呼吸法=${cur.breathing} / ストレッチ=${cur.stretch} / ツボ=${cur.tsubo} / 漢方薬=${cur.kampo}
Q4 動作=${cur.motion_level}
Q5 困りごと=${cur.q5_answer || "未入力"}

【前回→今回 改善点】
${praise.map(p => `${p.label}: ${p.d} 段階改善`).join(" / ") || "（特記事項なし）"}

【課題候補】
${bottleneck ? `${bottleneck.label}（スコア${bottleneck.v}）` : "（特記事項なし）"}

【体質ケアガイド全文（単一テキスト）】
${adviceText || "（未登録）"}

【次の一歩で強調したい柱（見出し用）】
${pillarJa}
    `.trim();

    const rsp = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // gpt-5 は temperature/top_p 非対応。max_tokens ではなく max_completion_tokens。
      max_completion_tokens: 480,
    });

    const replyText = rsp.choices?.[0]?.message?.content?.trim();

    // ===== フォールバック（常に可読な日本語を返す）=====
    if (!replyText) {
      const praiseLine = (praise && praise.length)
        ? `👏このまま続けるといいこと：${praise.map(p => `${p.label}が${p.d}段階よくなっています`).join("・")}。`
        : `👏このまま続けるといいこと：小さな積み重ねができています。`;

      const taskLine = bottleneck
        ? `🧭今週の課題：${bottleneck.label}（スコア${bottleneck.v}）。`
        : `🧭今週の課題：基礎の継続。`;

      // ガイド全文からの“安全な一歩”生成（先頭2〜3文を抜粋）
      const safeStep = adviceText
        ? adviceText.split(/\n+/).slice(0, 2).join(" ").slice(0, 120) + "。"
        : "今日は1分だけ、自分のためのケア時間を作ってみましょう。呼吸をゆっくり、心地よく。";

      const fb =
        `${header}\n` +
        `${praiseLine}\n` +
        `${taskLine}\n` +
        `➡️次にやってほしいこと（${pillarJa}）：${safeStep}\n` +
        `※本サービスは医療行為ではなくセルフケア支援です。`;

      return { gptComment: fb, statusMessage: "fallback" };
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
