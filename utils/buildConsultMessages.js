// utils/buildConsultMessages.js
// ===========================================
// AI相談用プロンプト生成
// - contexts（体質情報）
// - followups（ととのい度チェック：直近＋1つ前）
// - careLogs（日々のケア実施記録：短期＆長期）
// - recentChats（直近チャット3件）
// をまとめて GPT に渡す。
// ===========================================

const legend_v1 = require("./cache/legend_v1");      // サービス3機能のコンセプト説明
const rule_v1 = require("./cache/rule_v1");          // 応答ルール・文体・モード
const structure_v1 = require("./cache/structure_v1");// データ構造・スコアの読み方・因果構造

// ===========================================
// symptom を日本語ラベルに変換
// ===========================================
const symptomLabelMap = {
  stomach: "胃腸の調子",
  sleep: "睡眠・集中力",
  pain: "肩こり・腰痛・関節痛",
  mental: "イライラや不安感",
  cold: "体温バランス・むくみ",
  skin: "頭髪や肌の健康",
  pollen: "花粉症・鼻炎",
  women: "女性特有のお悩み",
  unknown: "なんとなく不調・不定愁訴",
};

// ===========================================
// advice 正規化：
// - 既に {habits, breathing, stretch, tsubo, kampo} 形式ならそのまま
// - 旧カルーセル形式 [{header, body, link}, ...] を pillar ごとに割り振る
// ===========================================
function normalizeAdvice(advice) {
  if (!advice) return null;

  // すでにオブジェクト形式ならそのまま
  const looksLikeObject =
    typeof advice === "object" &&
    (advice.habits ||
      advice.breathing ||
      advice.stretch ||
      advice.tsubo ||
      advice.kampo);
  if (looksLikeObject) return advice;

  // カルーセル配列 → {habits, breathing, stretch, tsubo, kampo}
  const r = {
    habits: null,
    breathing: null,
    stretch: null,
    tsubo: null,
    kampo: null,
  };
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

// ===========================================
// contexts から GPT に渡すサマリを抽出
// - symptomLabel / motion も含めて渡す
// ===========================================
function pickContext(context) {
  if (!context) {
    return {
      symptom: null,
      symptomLabel: null,
      type: null,
      trait: null,
      flowType: null,
      organType: null,
      motion: null,
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
    motion = null,
    advice = null,
    created_at = null,
  } = context;

  const symptomLabel =
    symptomLabelMap[symptom] || symptom || "からだの不調";

  return {
    symptom,          // 例: "stomach"
    symptomLabel,     // 例: "胃腸の調子"
    type,
    trait,
    flowType,
    organType,
    motion,           // 伸展テスト動作（日本語テキスト想定）
    advice: normalizeAdvice(advice),
    created_at,
  };
}

// ===========================================
// JSON stringify（壊れてても最低限返す）
// ===========================================
function toJSON(obj) {
  try {
    return JSON.stringify(obj ?? null, null, 2);
  } catch {
    return JSON.stringify({ _error: "unserializable" });
  }
}

/**
 * careCounts（日次記録）をそのまま「実施日数」として扱う
 * - 未定義は 0 に丸める
 * - 1日1カウント前提なので、「そのケアを行えた日数」のイメージ
 */
function normalizeCareCountsPerDay(rawCounts = {}) {
  const normalized = {};
  for (const [pillar, count] of Object.entries(rawCounts)) {
    normalized[pillar] = Number(count) || 0;
  }
  return normalized;
}

// ===========================================
// メイン：GPTに渡す messages を構築
// ===========================================
module.exports = function buildConsultMessages({
  context,
  followups,
  userText,
  recentChats = [],
  careCounts = {},
  extraCareCounts = null,
}) {
  // 1) 体質・所見（contexts）
  const ctx = pickContext(context);

  // 2) ととのい度チェック（直近・1つ前）
  const latest = followups?.latest ?? null;
  const prev   = followups?.prev   ?? null;

  // 3) ケア実施日数（短期：前回〜今回）
  const normalizedCareCounts = normalizeCareCountsPerDay(careCounts);

  // 4) ケア実施日数（長期：体質分析〜現在）※存在する場合のみ
  const longTermCareJson = extraCareCounts?.longTermCareCounts
    ? JSON.stringify(extraCareCounts.longTermCareCounts, null, 2)
    : null;

  // 5) 直近チャット履歴（最大3件・各300文字まで）
  const chatHistory = (recentChats || [])
    .slice(-3)
    .map((c) => ({
      role: c?.role === "assistant" ? "assistant" : "user",
      content: String(c?.message ?? c?.content ?? "").slice(0, 300),
    }))
    .filter((c) => c.content);

  // 6) system メッセージ組み立て
  const systemHeader = [
    "あなたは『ととのうケアナビ』（東洋医学×AIセルフケア支援サービス）のAIパートナー『トトノウくん』です。",
    "以下の情報（体質・ととのい度チェックの推移・ケア実施状況・過去の相談内容）を踏まえ、ユーザーに寄り添って答えてください。",
    "",
    // サービス3機能のコンセプト（地図/現在地/足あと）
    legend_v1,
    "",
    "▼ 体質・所見（contexts）",
    toJSON(ctx),
    "",
    "▼ 直近のケア実施記録（日数ベース：前回チェック〜今回）",
    toJSON(normalizedCareCounts),
    "",
    longTermCareJson
      ? "▼ サービス開始(体質分析)以降の累計ケア実施日数\n" +
        longTermCareJson
      : null,
    "",
    "（各ケア項目は1日1回扱い。短期は「1つ前〜直近のととのい度チェック日」、長期は「体質分析日〜現在」で集計しています）",
    "",
    prev
      ? "▼ ととのい度チェック（1つ前のチェック結果・比較用）\n" +
        toJSON(prev)
      : null,
    "",
    "▼ ととのい度チェック（直近のチェック結果）",
    toJSON(latest),
    "",
    // データ構造・数値の読み方・優先ケアロジック・因果
    structure_v1,
    "",
    // 出力フォーマット・文体・ケア効果モードのルール
    rule_v1,
  ]
    .filter(Boolean)
    .join("\n");

  // 7) OpenAI Responses API に渡す messages
  return [
    { role: "system", content: systemHeader },
    ...chatHistory,
    { role: "user", content: String(userText || "").trim() },
  ];
};
