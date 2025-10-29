/**
 * followup/responseSender.js
 * =======================================
 * ととのい度チェック（AIトトノウくん）
 * - 行動スコア＋体調反映度スコアを分離
 * - 推奨頻度と優先順位付きのケアプラン生成
 * - GPT-5 JSON出力（2枚カード構成）
 * =======================================
 */

const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// -------------------------------
// 1️⃣ スコア系ユーティリティ
// -------------------------------

function normalizeFollowup(ans = {}) {
  const n = (v, def) => (v === null || v === undefined || v === "" ? def : Number(v));
  return {
    symptom_level: n(ans.symptom_level, 3),
    sleep:  n(ans.sleep, 3),
    meal:   n(ans.meal, 3),
    stress: n(ans.stress, 3),
    motion_level: n(ans.motion_level, 3),
  };
}

/** 前回→今回の体調変化スコア（低下＝改善） */
function calcReflectionScore(prev, cur) {
  if (!prev || !cur) return 50;
  const diffs = [
    prev.symptom_level - cur.symptom_level,
    prev.sleep - cur.sleep,
    prev.meal - cur.meal,
    prev.stress - cur.stress,
    prev.motion_level - cur.motion_level,
  ];
  const avgDiff = diffs.reduce((a,b)=>a+b,0) / diffs.length;
  const raw = 60 + avgDiff * 10; // 平均±3 → ±30点
  const bounded = Math.max(0, Math.min(100, Math.round(raw)));
  const starsNum = Math.max(1, Math.min(5, Math.ceil(bounded / 20)));
  return { reflectionScore: bounded, starsNum, stars: "★".repeat(starsNum) + "☆".repeat(5 - starsNum) };
}

/** 行動スコア（care_logsから計算） */
function calcActionScore(counts, days = 8) {
  const total = Object.values(counts).reduce((a,b)=>a+b,0);
  const maxPossible = days * 5; // 1日5pillar
  const ratio = total / maxPossible;
  const score = Math.min(100, Math.round(ratio * 100));
  return score;
}

/** 総合整い度（行動40%、体調60%） */
function calcTotalScore(actionScore, reflectionScore) {
  const combined = Math.round(actionScore * 0.4 + reflectionScore * 0.6);
  const starsNum = Math.max(1, Math.min(5, Math.ceil(combined / 20)));
  return { totalScore: combined, starsNum, stars: "★".repeat(starsNum) + "☆".repeat(5 - starsNum) };
}

// -------------------------------
// 2️⃣ GPT呼び出し（JSON構造生成）
// -------------------------------

async function callTotonouGPT(systemPrompt, userPrompt) {
  try {
    const rsp = await openai.responses.create({
      model: "gpt-5",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      reasoning: { effort: "medium" },
      text: { verbosity: "medium" }
    });

    const raw = rsp.output_text?.trim() || "";
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const s = cleaned.indexOf("{");
      const e = cleaned.lastIndexOf("}");
      if (s >= 0 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
      return null;
    }
  } catch (err) {
    console.error("トトノウくんGPTエラー:", err);
    return null;
  }
}

// -------------------------------
// 3️⃣ メイン処理：フォローアップ返信
// -------------------------------

async function sendFollowupResponse(userId, followupAnswers) {
  try {
    // ユーザー情報
    const users = await supabaseMemoryManager.getSubscribedUsers();
    const user = users.find(u => u.id === userId);
    if (!user?.line_id) throw new Error("user.line_id 未取得");

    // context 取得
    const context = await supabaseMemoryManager.getContext(user.line_id);
    if (!context) return { gptComment: "体質情報が見つかりません。", statusMessage: "no-context" };
    const { advice, start_date } = context;

    // 直近 followup
    const { latest, prev } = await supabaseMemoryManager.getLastTwoFollowupsByUserId(userId);
    const curN = normalizeFollowup(followupAnswers || latest);
    const prevN = prev ? normalizeFollowup(prev) : null;

    // care_logs（行動ログ集計）
    const careCounts = await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(user.line_id);

    // スコア算出
    const actionScore = calcActionScore(careCounts, 8);
    const { reflectionScore, starsNum: reflectStars, stars: reflectStarsText } = calcReflectionScore(prevN, curN);
    const { totalScore, starsNum: totalStarsNum, stars: totalStarsText } = calcTotalScore(actionScore, reflectionScore);

    // シンプル補正：開始日からの日数
    const startDate = start_date ? new Date(start_date) : null;
    const daysSinceStart = startDate ? Math.floor((Date.now() - startDate.getTime()) / (1000*60*60*24)) : 30;
    const activeDaysFactor = Math.min(1, daysSinceStart / 14); // 14日未満は補正
    const correctedActionScore = Math.round(actionScore * activeDaysFactor);

// =============================
// GPT呼び出し
// =============================
const systemPrompt = `
あなたは「トトノウくん」🧘‍♂️。
東洋医学に基づく体質セルフケアのAIアシスタントです。
ユーザーを「褒めて伸ばす」トーンで、**2枚カード形式のJSON**のみを出力してください。

▼ 目的
前回と今回の体調データ、直近のセルフケア実施データ（care_logs）、
および各柱の助言内容（advice）を踏まえ、
ユーザーが「今週どんなペースで整えればよいか」を分かりやすく提案します。

▼ 出力構造
{
  "card1": {
    "lead": "冒頭ひとこと（親しみ＋体調まとめ）",
    "body": "体調・行動の現状と今週の方向性を2〜3文で説明。"
  },
  "card2": {
    "lead": "ケアプランの導入文（例：「今週はこの順で整えよう🌿」）",
    "care_plan": [
      {
        "pillar": "呼吸法",
        "priority": 1,
        "recommended_frequency": "毎日",
        "reason": "ストレスが高く、自律神経を整える必要があるため。",
        "reference_link": "https://..." // contexts.adviceから抽出
      }
    ],
    "footer": "最後のひとこと（応援メッセージ）"
  }
}

▼ 因果の見方（AIが推定に使う一次KPIと二次効果）
・habits ↔ sleep / meal / stress → symptom_level：
　一次KPI＝sleep/meal/stress。habitsの実践は生活リズムを整えやすく、逆に乱れはhabits実践を阻害しやすい。
　生活リズムが整うと二次効果として symptom_level が下がりやすい。
・stretch / tsubo ↔ motion_level → symptom_level：
　一次KPI＝motion_level（＝advice.stretch と同じ動きをしたときの伸展時のつらさ）。
　該当経絡へのストレッチ/ツボが効けば動作時痛が下がり、経絡・関連臓腑の負担が軽減して結果的に symptom_level も改善しやすい。
　motion_level の悪化は stretch/tsubo 未実施や負荷過多のサイン。
・breathing → sleep / stress → symptom_level：
　一次KPI＝sleep/stress。鳩尾〜臍（中脘あたり）に息を入れる腹式呼吸で腹圧・深層呼吸筋・内臓を賦活し、
　自律調整が働いて sleep / stress を整え、最終的に symptom_level の改善を後押しする。
・kampo（補助線）：
　他の柱が一定以上できていても symptom_level / motion_level が停滞する時の候補。
　常用はせず、最終手段として検討。

▼ 解釈のヒント（優先度の決め方の例）
・motion_level が高い かつ stretch/tsubo が「時々・未着手」→ まず stretch/tsubo を優先。
・sleep/meal/stress が複数で高い かつ habits が「時々・未着手」→ habits を優先。
・sleep または stress が高い かつ breathing が「時々・未着手」→ breathing を優先。
・3〜4回のチェックで実施度は良好（継続/継続中）なのに症状が停滞 → kampo を候補に（用量・頻度や負荷の見直しも併記）。

▼ 出力ルール
- トーン：親しみ＋前向き。「できたことを認めて、次の一歩を提案」
- JSONのみ出力。余計な文章は禁止。
- pillar順はpriority順。推奨頻度は「毎日」「週2〜3回」「週1回」など。
- 行動スコア・体調反映度・総合スコアを考慮して頻度と優先度を決定。
`.trim();

    const userPrompt = `
【スコア情報】
・セルフケア実施度（行動）：${correctedActionScore}点
・体調反映度：${reflectionScore}点（${reflectStarsText}）
・総合整い度：${totalScore}点（${totalStarsText}）

【利用開始日】${startDate ? startDate.toISOString().slice(0,10) : "不明"}
【直近8日間のケア実施回数】${JSON.stringify(careCounts, null, 2)}

【体調変化】
前回→今回の症状：${prevN ? prevN.symptom_level + "→" + curN.symptom_level : "初回"}
睡眠：${prevN ? prevN.sleep + "→" + curN.sleep : "初回"}
食事：${prevN ? prevN.meal + "→" + curN.meal : "初回"}
ストレス：${prevN ? prevN.stress + "→" + curN.stress : "初回"}
動作：${prevN ? prevN.motion_level + "→" + curN.motion_level : "初回"}

【adviceリンク一覧】
${JSON.stringify(advice, null, 2)}
`.trim();

    const jsonOut = await callTotonouGPT(systemPrompt, userPrompt);
    if (!jsonOut) throw new Error("GPT出力が空");

    const gptComment = `
${jsonOut.card1?.lead || ""}

${jsonOut.card1?.body || ""}

———🧘‍♂️———

${jsonOut.card2?.lead || ""}

${(jsonOut.card2?.care_plan || []).map(p =>
  `・${p.pillar}（${p.recommended_frequency}）\n　${p.reason}`
).join("\n\n")}

${jsonOut.card2?.footer || ""}
`.trim();

    return { sections: jsonOut, gptComment, statusMessage: "ok" };

  } catch (err) {
    console.error("トトノウくんresponseSenderエラー:", err);
    return { gptComment: "トトノウくんが少し休憩中みたいです。少し時間を置いて再試行してください。", statusMessage: "error" };
  }
}

module.exports = { sendFollowupResponse };
