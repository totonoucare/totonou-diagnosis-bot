// utils/buildConsultMessages.js
// ===========================================
// AI相談用プロンプト生成：contexts / followups / careLogs / 直近チャット3件を参照
// 「ととのい度チェック」は体調スコア、「ケアログ」は日々の実践記録として扱う。
// ===========================================

function normalizeAdvice(advice) {
  if (!advice) return null;

  // 既に {habits, breathing, stretch, tsubo, kampo} 形式ならそのまま返す
  const looksLikeObject =
    typeof advice === "object" &&
    (advice.habits || advice.breathing || advice.stretch || advice.tsubo || advice.kampo);
  if (looksLikeObject) return advice;

  // カルーセル配列 [{header, body, link}, ...] を分類
  const r = { habits: null, breathing: null, stretch: null, tsubo: null, kampo: null };
  const arr = Array.isArray(advice) ? advice : [];

  for (const card of arr) {
    const header = String(card?.header || "");
    const body = String(card?.body || "");
    const link = String(card?.link || "");
    const combined = link ? `${body}\n\n【図解リンク】${link}` : body;

    if (/体質改善|習慣/.test(header)) r.habits = combined;
    else if (/呼吸/.test(header)) r.breathing = combined;
    else if (/ストレッチ/.test(header)) r.stretch = combined;
    else if (/ツボ/.test(header)) r.tsubo = combined;
    else if (/漢方/.test(header)) r.kampo = combined;
  }

  return r;
}

function pickContext(context) {
  if (!context) {
    return {
      symptom: null,
      type: null,
      trait: null,
      flowType: null,
      organType: null,
      advice: null,
      created_at: null,
    };
  }
  const {
    symptom = null,
    type = null,
    trait = null,
    flowType = null,
    organType = null,
    advice = null,
    created_at = null,
  } = context;

  return {
    symptom,
    type,
    trait,
    flowType,
    organType,
    advice: normalizeAdvice(advice),
    created_at,
  };
}

function toJSON(obj) {
  try { return JSON.stringify(obj ?? null, null, 2); }
  catch { return JSON.stringify({ _error: "unserializable" }); }
}

/**
 * careCounts（日次記録）を1日1回扱いに丸める
 * - 1回以上なら「1」として扱う
 * - 未定義は0扱い
 * - 上限は設定しない（期間依存）
 */
function normalizeCareCountsPerDay(rawCounts = {}) {
  const normalized = {};
  for (const [pillar, count] of Object.entries(rawCounts)) {
    normalized[pillar] = count > 0 ? 1 : 0;
  }
  return normalized;
}


/**
 * ▼ GPT向けスコア・ケアログ構造説明
 * （Q3の「実施度」質問は廃止。care_logs_daily により日次記録を自動カウント）
 */
function buildScoreLegend() {
  const lines = [
    "▼ ととのい度チェックとは？",
    "・体の状態を数値で自己評価するチェックです。symptom_level（主訴の強さ）と、生活リズム指標（sleep / meal / stress）および動作時のつらさ（motion_level）を1〜5で入力します。",
    "・数値は 1 が良好、5 が乱れ・つらさの強い状態を示します。",
    "・ケアの実施状況は別の仕組み（care_logs_daily）で自動的に保存されます。",
    "",
    "▼ ケアログ（care_logs_daily）とは？",
    "・ユーザーが実施ボタンを押すことで、体質改善習慣・呼吸法・ストレッチ・ツボ刺激・漢方の各セルフケア項目が記録されます。",
    "・同一日に同じケアを複数回行っても1回として扱われます。",
    "・直近の『ととのい度チェック』から次のチェックまでの期間で集計します。",
    "",
    "▼ 因果構造（整いのメカニズム）",
    "1. habits（体質改善習慣） ↔ sleep / meal / stress → symptom_level：",
    "　体質分析で把握された気・血・津液・寒熱のバランスを整える基盤ケア。生活習慣を整えることで睡眠・食事・ストレスのリズムが安定し、主訴の改善につながる。",
    "",
    "2. breathing（呼吸法） ↔ 構造バランス・腹圧テンション → symptom_level：",
    "　中脘（みぞおちと臍の間）のあたりを軽く膨らませる(胸式でもなく、臍下を突き出す呼吸でもない)深呼吸によって、腹圧と体幹テンションが安定し、姿勢と循環が整いやすくなる。構造的な安定が、全身の“整い”を支える。",
    "",
    "3. motion_level ↔ stretch / tsubo → symptom_level：",
    "　体質分析時に最も負担があった経絡動作(motion)をもとに、ストレッチやツボ刺激でその経絡ラインのテンション(筋膜ライン)を緩め、関連臓腑のバランスも整える。motion_level の改善はこの経絡ケアの成果指標となる。",
    "",
    "4. kampo（漢方）：",
    "　セルフケアを続けても改善が停滞している場合、弁証に基づく漢方を補助的に用いる。ただし依存せず、自律的ケアの補助として扱う。",
    "",
    "▼ 評価構造（内部算出）",
    "・セルフケア実施努力点（actionScoreFinal）：前回チェック以降(初回なら体質分析以降)、どれだけ提案されたケアを実践できたか（行動密度）。",
    "・ケア効果反映度（careEffectScore）：努力がどれだけ体調改善に反映されたか（行動×改善）。",
    "・これら2つのスコアをもとに、総合的な整い度を評価する。",
  ];
  return lines.join('\n');
}

// ===========================================
// メイン：GPTに渡すプロンプトを組み立てる
// ===========================================
module.exports = function buildConsultMessages({
  context,
  followups,
  userText,
  recentChats = [],
  careCounts = {},
}) {
  const ctx = pickContext(context);
  const latest = followups?.latest ?? null;
  const prev = followups?.prev ?? null;

  // ✅ 丸め処理をここで適用！
  const normalizedCareCounts = normalizeCareCountsPerDay(careCounts);

  const chatHistory = (recentChats || [])
    .slice(-3)
    .map((c) => {
      const role = c?.role === "assistant" ? "assistant" : "user";
      const content = String(c?.message ?? c?.content ?? "").slice(0, 300);
      if (!content) return null;
      return { role, content };
    })
    .filter(Boolean);

  const systemHeader = [
    "あなたは『ととのうケアナビ』（東洋医学×AIセルフケア支援サービス）のAIパートナー『トトノウくん』です。",
    "以下の情報（体質・直近のととのい度チェック・ケア実施状況・過去の相談内容）を踏まえ、ユーザーに寄り添って答えてください。",
    "",
    "▼ 体質・所見（contexts）",
    toJSON(ctx),
    "",
    "▼ 直近のケア実施記録（care_logs_daily 集計結果）",
    toJSON(normalizedCareCounts),
    "",
    "（各ケア項目は1日1回扱い。前回の『ととのい度チェック』から今回までの期間で集計しています）",
    "",
    "▼ ととのい度チェック（最新）",
    toJSON(latest),
    "",
    "▼ ととのい度チェック（前回）",
    toJSON(prev),
    "",
    buildScoreLegend(),
    "",
    "【回答方針】",
    "1) contexts（体質・所見）・followups（体調スコア）・care_logs（実践データ）・直近会話を総合的に考慮し、今の状態に沿った具体的で現実的なアドバイスを提示する。",
    "2) 相談内容がcontexts.advice（セルフケア提案）と直接関係しない場合も、東洋医学・構造学の観点から適切な方向性を提案してよい。",
    "3) 表現はLINE向けに短く、250字程度を目安に。段落を分け、絵文字を適度に使ってやさしく伝える。専門用語はやさしく言い換える。",
    "4) adviceにURL（図解リンク）が含まれる場合は https://〜 の形で紹介（LINEが自動リンク化）。",
    "5) 医学的診断・処方はしない。重症・急性兆候がある場合は受診案内を優先。",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system", content: systemHeader },
    ...chatHistory,
    { role: "user", content: String(userText || "").trim() },
  ];
};
