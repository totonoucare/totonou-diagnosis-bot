// followup/responseSender.js
// =======================================
// 「トトノウくん」用レスポンス生成
// - セルフケア実施努力点（行動密度）
// - ケア効果反映度（努力×改善）
// - 停滞時の派生ケア・相談提案を判断
//
// 返却フォーマット：
// {
//   sections: { card1:{...}, card2:{...} },
//   gptComment: <フォールバック用テキスト>,
//   statusMessage: "ok"|"error"|"no-context"
// }
// =======================================

const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------------------
   1) データ整形・スコア計算ユーティリティ
--------------------------- */

// 回答の正規化（null→デフォ3）
function normalizeFollowup(ans = {}) {
  const n = (v, def) =>
    v === null || v === undefined || v === "" ? def : Number(v);
  return {
    symptom_level: n(ans.symptom_level, 3),
    sleep: n(ans.sleep, 3),
    meal: n(ans.meal, 3),
    stress: n(ans.stress, 3),
    motion_level: n(ans.motion_level, 3),
  };
}

/**
 * セルフケア実施努力点（行動スコア）
 * - 各pillarの日数密度を加重平均
 * - 漢方は0.25倍の補助ケア扱い
 */
function calcActionScore(careCounts, effectiveDays) {
  const weights = {
    habits: 1.0,
    breathing: 1.0,
    stretch: 1.0,
    tsubo: 1.0,
    kampo: 0.25,
  };

  const weightedTotal = Object.entries(weights)
    .map(([pillar, w]) => {
      const count = careCounts[pillar] || 0;
      return (count / effectiveDays) * w;
    })
    .reduce((a, b) => a + b, 0);

  const maxWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const ratio = maxWeight > 0 ? weightedTotal / maxWeight : 0;
  const rawScore = Math.round(Math.min(1, ratio) * 100);

  const totalActions = Object.values(careCounts).reduce((a, b) => a + b, 0);
  return { actionScoreRaw: rawScore, totalActions };
}

/**
 * ケア効果反映度（行動×体調変化）
 * - 行動が多いほど改善の信頼度を高める
 * - 改善がなくても努力で加点（UX安定）
 */
function calcCareEffectScore(prevN, curN, actionScoreRaw = 0) {
  if (!prevN || !curN) {
    const careEffectScore = 50;
    const starsNum = Math.max(1, Math.min(5, Math.ceil(careEffectScore / 20)));
    return {
      careEffectScore,
      careEffectStarsNum: starsNum,
      careEffectStarsText: "★".repeat(starsNum) + "☆".repeat(5 - starsNum),
      careEffectDelta: null,
    };
  }

  const diffs = [
    prevN.symptom_level - curN.symptom_level,
    prevN.sleep - curN.sleep,
    prevN.meal - curN.meal,
    prevN.stress - curN.stress,
    prevN.motion_level - curN.motion_level,
  ];
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;

  const actionFactor = Math.min(1, Math.max(0, actionScoreRaw / 100));
  const reflectionEfficiency = avgDiff * actionFactor;

  const effortBoost = Math.round(actionFactor * 15);
  const raw = 60 + reflectionEfficiency * 30 + effortBoost;
  const bounded = Math.max(0, Math.min(100, Math.round(raw)));

  const starsNum = Math.max(1, Math.min(5, Math.ceil(bounded / 20)));
  return {
    careEffectScore: bounded,
    careEffectStarsNum: starsNum,
    careEffectStarsText: "★".repeat(starsNum) + "☆".repeat(5 - starsNum),
    careEffectDelta: avgDiff,
  };
}

/**
 * 日内重複を1日1回扱いに丸める
 */
function normalizeCareCountsPerDay(careCounts) {
  if (!careCounts || typeof careCounts !== "object") return {};
  const normalized = {};
  for (const [pillar, count] of Object.entries(careCounts)) {
    const n = Number(count) || 0;
    normalized[pillar] = n > 0 ? 1 : 0;
  }
  return normalized;
}

/**
 * 停滞判定：改善が2回連続で鈍化
 */
function judgeStagnation(reflectionHistory) {
  if (!Array.isArray(reflectionHistory) || reflectionHistory.length < 2)
    return { isStuck2Times: false, severity: null };

  const len = reflectionHistory.length;
  const last = reflectionHistory[len - 1];
  const prev = reflectionHistory[len - 2];
  const diffAbs = Math.abs(last - prev);
  const noChange = diffAbs < 5;

  if (!noChange) return { isStuck2Times: false, severity: null };
  if (last < 40) return { isStuck2Times: true, severity: "heavy" };
  if (last < 60) return { isStuck2Times: true, severity: "mild" };
  return { isStuck2Times: false, severity: null };
}

/* ---------------------------
   2) GPT呼び出しラッパ
--------------------------- */

async function callTotonouGPT(systemPrompt, userPrompt) {
  try {
    const rsp = await openai.responses.create({
      model: "gpt-5",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      reasoning: { effort: "minimal" },
      text: { verbosity: "medium" },
    });

    let raw = rsp.output_text?.trim() || "";
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    }

    try {
      return JSON.parse(raw);
    } catch {
      const s = raw.indexOf("{");
      const e = raw.lastIndexOf("}");
      if (s >= 0 && e > s) return JSON.parse(raw.slice(s, e + 1));
      return null;
    }
  } catch (err) {
    console.error("❌ callTotonouGPT error:", err);
    return null;
  }
}

/* ---------------------------
   3) メイン：フォローアップ処理
--------------------------- */

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

async function sendFollowupResponse(userId, followupAnswers) {
  try {
    // 1. userId→lineId
    const users = await supabaseMemoryManager.getSubscribedUsers();
    const userRow = users.find((u) => u.id === userId);
    if (!userRow?.line_id) throw new Error("userIdに対応するline_idが見つかりません");
    const lineId = userRow.line_id;

    // 2. コンテキスト取得
    const context = await supabaseMemoryManager.getContext(lineId);
    if (!context)
      return {
        sections: null,
        gptComment: "初回の体質ケア情報が見つかりません。体質分析から始めましょう🌿",
        statusMessage: "no-context",
      };
    const { advice } = context;

    const symptomName = symptomLabels[context.symptom] || "不明な主訴";
    const motionName = context.motion || "指定の動作";

    // 3. followup履歴取得
    const { latest, prev } =
      await supabaseMemoryManager.getLastTwoFollowupsByUserId(userId);
    const curN = normalizeFollowup(followupAnswers || latest || {});
    const prevN = prev ? normalizeFollowup(prev) : null;

// 4. care_logs取得（短期＋長期の両方）
// supabaseMemoryManager.js 側で distinct 日数に丸め済みなので、ここではそのまま利用。
const shortTermCareCounts =
  await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(lineId); // 前回followup〜現在（日数）
const longTermCareCounts =
  await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(lineId, { includeContext: true }); // context作成日〜現在（日数）

// normalizeCareCountsPerDay は不要（supabase 側で丸め済み）
const careCounts = shortTermCareCounts;

   

    // 5. 経過日数を算出
    const now = Date.now();
    const prevDate = prev?.created_at ? new Date(prev.created_at).getTime() : null;
    const contextDate = context?.created_at ? new Date(context.created_at).getTime() : null;
    const effectiveDays =
      prevDate
        ? Math.max(1, Math.floor((now - prevDate) / (1000 * 60 * 60 * 24)))
        : contextDate
        ? Math.max(1, Math.floor((now - contextDate) / (1000 * 60 * 60 * 24)))
        : 1;

    // ✅ daysSinceStartを定義（userPromptで使用）
    const daysSinceStart = contextDate
      ? Math.max(1, Math.floor((now - contextDate) / (1000 * 60 * 60 * 24)))
      : effectiveDays;

    // 6. 行動スコア
    const { actionScoreRaw, totalActions } = calcActionScore(careCounts, effectiveDays);
    const actionScoreFinal = Math.max(actionScoreRaw, 30);

    // 7. ケア効果反映度
    const { careEffectScore, careEffectStarsText } = calcCareEffectScore(
      prevN,
      curN,
      actionScoreRaw
    );

    // 8. 停滞判定
    const reflectionHistory = [];
    if (prevN) {
      const prevScoreBlock = calcCareEffectScore(null, prevN, 0).careEffectScore;
      reflectionHistory.push(prevScoreBlock);
    }
    reflectionHistory.push(careEffectScore);
    const stagnationInfo = judgeStagnation(reflectionHistory);

/* ---------------------------
   9) GPTへのプロンプト準備
--------------------------- */

const systemPrompt = `
あなたは『トトノウくん』🧘‍♂️。  
東洋医学と身体構造学（テンセグリティ理論）をベースに、  
ユーザーの体と心の「整い方」を優しく支援するAIパートナーです。  
数字やデータをもとに、安心・共感・希望を届けてください。

---

## 🔹 データ構造（AIが理解しておくべき情報）

### contexts（体質・タイプ情報）
- type：体質タイプ（気虚・血虚・瘀血など）
- trait：体質傾向（冷えやすい、熱がこもりやすい等）
- flowType：気の流れの特徴（上実下虚、停滞、循環良好など）
- organType：負担が出やすい臓腑（肝・脾・腎など）
- symptom：主訴（胃腸・肩こり・メンタル・冷えなど）
- advice：{habits, breathing, stretch, tsubo, kampo} 各ケア内容とリンク
- created_at：初回登録日（体質分析を終えた日）

### followups（ととのい度チェック）
- symptom_level：主訴のつらさ（1=軽い〜5=強い）
- sleep / meal / stress：生活リズム（1=整っている〜5=乱れている）
- motion_level：体質分析時に最も辛かった経絡動作を再テストした際のつらさ（1=軽い〜5=強い）

### care_logs_daily（ケア記録）
- habits / breathing / stretch / tsubo / kampo：各ケア項目の実施回数。
- 1日に複数回行えばその分カウント。数値が高いほど、そのケアをよく実施している。

---

## 🔸 評価構造（トトノウくんの思考モデル）

- **セルフケア実施努力点（actionScoreFinal）**  
　期間中にどれだけケアを実践できたか（行動密度）。  
　生活系4柱（habits, breathing, stretch, tsubo）を重視し、  
　漢方（kampo）は0.25倍の補助加点。

- **ケア効果反映度（careEffectScore）**  
　行動スコアを「努力の信頼性」として重み付けし、  
　体調スコア（sleep, meal, stress, motion_level, symptom_level）の変化から  
　“努力がどれだけ結果に結びついたか”を算出。  
　改善がなくても、努力には一定の加点がある。

---

## 🔸 因果構造（整いのメカニズム）

1. habits（体質改善習慣） ↔ sleep / meal / stress → symptom_level：

　体質分析で把握された気血や寒熱のバランスを整える基盤ケア。生活習慣を整えることで睡眠・食事・ストレスのリズムが安定し、主訴(不調)の改善につながる。

2. breathing（呼吸法） ↔ 構造バランス・腹圧テンション → symptom_level：
　中脘（みぞおちと臍の間）のあたりを軽く膨らませる(胸式でもなく、臍下を突き出す呼吸でもない)深呼吸によって、腹圧と体幹テンションが安定し、姿勢と循環が整いやすくなる。
  構造的な安定が、全身の“整い”を支える。結果として循環と自律神経が整いやすくなる。、
　（※呼吸と姿勢の調和に留め、神経改善を断定しない）

3. motion_level ↔ stretch / tsubo → symptom_level：
　体質分析時に最も負担があった経絡の伸展動作(motion)をもとに、ストレッチやツボ刺激でその経絡ラインのテンション(筋膜ライン)を緩め、関連臓腑のバランスも整える。
  motion_level の改善はこの経絡ケアの成果指標となる。

4. kampo（漢方）：
　他のセルフケア（habits, breathing, stretch, tsubo）を一定期間継続しても
　体調や motion_level の改善が停滞している場合、
　補助的な手段として体質・弁証に基づいた漢方を取り入れることを検討します。
　ただし、継続的依存は避け、あくまで自律的ケアの補助として扱います。

---

## 🔸 出力仕様
出力は必ず次の形式で返してください：

{
  "card1": {
    "lead": "冒頭メッセージ。努力と反映をねぎらう。",
    "score_block": {
      "action": {
        "label": "セルフケア実施努力点",
        "score_text": "NN点",
        "explain": "どれだけ行動できたか"
      },
      "effect": {
        "label": "ケア効果反映度",
        "stars": "★★★☆☆",
        "explain": "努力がどれだけ体調に反映されたか"
      }
    },
    "guidance": "今日からのセルフケア指針"
  },
  "card2": {
    "lead": "『今週はこの優先順位で整えよう🌿』のようなフォーカス宣言。",
    "care_plan": [
      {
        "pillar": "呼吸法" | "体質改善習慣" | "ストレッチ" | "ツボ" | "漢方" | "相談サポート",
        "priority": 1,
        "recommended_frequency": "毎日" | "週2〜3回" | "必要な時",
        "reason": "なぜ今これが優先か（体調・構造・メンタル面を踏まえて）",
        "reference_link": "contexts.advice 内の対応リンクまたは識別テキスト"
      }
    ],
    "footer": "最後の励ましメッセージ。例：『焦らず、今日の1回が未来の整いをつくるよ🫶』"
  }
}
`.trim();

const userPrompt = `
【スコア情報】
- セルフケア実施努力点: ${actionScoreFinal}点
- ケア効果反映度: ${careEffectScore}点
- ケア効果反映度の星: ${careEffectStarsText}
- 実施合計（期間中の日数換算）: ${totalActions}回
- 評価対象日数: ${effectiveDays}日
- サービス利用開始からの日数: ${daysSinceStart}日

【体調スコア（今回）】
- 主訴の強さ(symptom_level): ${curN.symptom_level}（1=軽い〜5=強い）
- 睡眠(sleep): ${curN.sleep}（1=整っている〜5=乱れ）
- 食事(meal): ${curN.meal}（1=整っている〜5=乱れ）
- ストレス(stress): ${curN.stress}（1=落ち着いている〜5=強い）
- 動作のつらさ(motion_level): ${curN.motion_level}（1=軽い〜5=強い）

【体質・症状情報】
- 主訴カテゴリ: ${symptomName}
- 動作テスト対象（motion動作）: ${motionName}

【停滞情報】
- isStuck2Times: ${stagnationInfo.isStuck2Times}
- stagnationSeverity: ${stagnationInfo.severity || "null"}

【adviceデータ】
${JSON.stringify(advice, null, 2)}

【短期ケア実施状況（前回チェック以降）】
${JSON.stringify(careCounts, null, 2)}

【長期ケア実施状況（体質分析以降の累計）】
${JSON.stringify(longTermCareCounts, null, 2)}

---

【補足メモ】
- 「セルフケア実施努力点」は、どれだけ継続的にケアを実践できたかを表します。
- 「ケア効果反映度」は、努力がどの程度、体調改善（主訴・生活リズム・構造安定）に結びついたかを表します。
- 「停滞」がある場合は、無理に回数を増やすよりも「やり方の質」や「方向性の再調整」「相談」を促してください。
- 出力JSONは、card1とcard2の2枚構成で返すこと。care_plan は最大3件まで出力すること。それ以上は出さないこと。

`.trim();

    // 10. GPT呼び出し
    const sections = await callTotonouGPT(systemPrompt, userPrompt);
    if (!sections)
      return {
        sections: null,
        gptComment: "トトノウくんが今週のケアをまとめられませんでした🙏",
        statusMessage: "error",
      };

    // 11. フォールバックコメント生成
    const fallbackLines = [];
    fallbackLines.push(sections.card1.lead || "");
    fallbackLines.push("");
    fallbackLines.push(sections.card1.guidance || "");
    fallbackLines.push("");
    fallbackLines.push(sections.card2.lead || "");
    const planPreview = (sections.card2.care_plan || [])
      .map(
        (p, idx) =>
          `${idx + 1}位: ${p.pillar}（${p.recommended_frequency}）\n${p.reason}`
      )
      .join("\n\n");
    fallbackLines.push(planPreview);
    fallbackLines.push("");
    fallbackLines.push(sections.card2.footer || "");

    const gptComment = fallbackLines.join("\n");

    return { sections, gptComment, statusMessage: "ok" };
  } catch (err) {
    console.error("❌ sendFollowupResponse error:", err);
    return {
      sections: null,
      gptComment: "今週のケアプラン生成中にエラーが発生しました。",
      statusMessage: "error",
    };
  }
}

module.exports = { sendFollowupResponse };
