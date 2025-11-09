// utils/buildConsultMessages.js
// ===========================================
// AI相談用プロンプト生成：contexts / followups / careLogs / 直近チャット3件を参照
// 「ととのい度チェック」は体調スコア、「ケアログ」は日々の実践記録として扱う。
// ===========================================

const legend_v1 = require("./cache/legend_v1");
const rule_v1 = require("./cache/rule_v1");
const structure_v1 = require("./cache/structure_v1");

// ===========================================
// AI相談用プロンプト生成：contexts / followups / careLogs / 直近チャット3件を参照
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
    normalized[pillar] = Number(count) || 0; // ← 🩵 修正: 0 or 実際の日数を保持
  }
  return normalized;
}


module.exports = function buildConsultMessages({
  context,
  followups,
  userText,
  recentChats = [],
  careCounts = {},
  extraCareCounts = null,
}) {
  const ctx = pickContext(context);
  const latest = followups?.latest ?? null;
  const prev = followups?.prev ?? null;
  const normalizedCareCounts = normalizeCareCountsPerDay(careCounts);
  const longTermCareJson = extraCareCounts?.longTermCareCounts
    ? JSON.stringify(extraCareCounts.longTermCareCounts, null, 2)
    : null;

  const chatHistory = (recentChats || [])
    .slice(-3)
    .map((c) => ({
      role: c?.role === "assistant" ? "assistant" : "user",
      content: String(c?.message ?? c?.content ?? "").slice(0, 300),
    }))
    .filter((c) => c.content);

  const systemHeader = [
    "あなたは『ととのうケアナビ』（東洋医学×AIセルフケア支援サービス）のAIパートナー『トトノウくん』です。",
    "以下の情報（体質・直近のととのい度チェック・ケア実施状況・過去の相談内容）を踏まえ、ユーザーに寄り添って答えてください。",
    "",
    "▼ 体質・所見（contexts）",
    toJSON(ctx),
    "",
    "▼ 直近のケア実施記録",
    toJSON(normalizedCareCounts),
    "",
    longTermCareJson
      ? "▼ サービス開始(体質分析)以降の累計ケア実施日数\n" + longTermCareJson
      : null,
    "",
    "（各ケア項目は1日1回扱い。短期は1つ前〜直近のととのい度チェック日、長期は体質分析日〜現在で集計しています）",
    "",
    "▼ ととのい度チェック（直近のチェック結果）",
    toJSON(latest),
    "",

    structure_v1,
    "",
    rule_v1,
    "",
    legend_v1,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system", content: systemHeader },
    ...chatHistory,
    { role: "user", content: String(userText || "").trim() },
  ];
};
