// utils/buildConsultMessages.js
// AI相談用のプロンプト生成：codeは使わず、contextsとfollowupsのみ参照。

function normalizeAdvice(advice) {
  if (!advice) return null;

  // 既に {habits, breathing, stretch, tsubo, kampo} 形式ならそのまま返す
  const looksLikePillars =
    typeof advice === "object" &&
    (advice.habits || advice.breathing || advice.stretch || advice.tsubo || advice.kampo);
  if (looksLikePillars) return advice;

  // カルーセル配列 [{header, body}, ...] を5本柱に分類
  // header のキーワードで判定（完全一致でなく “含む” 判定）
  const r = { habits: null, breathing: null, stretch: null, tsubo: null, kampo: null };
  const arr = Array.isArray(advice) ? advice : [];
  for (const card of arr) {
    const header = String(card?.header || "");
    const body = String(card?.body || "");
    const h = header;

    if (/体質改善|習慣/.test(h)) {
      r.habits = body;
      continue;
    }
    if (/呼吸/.test(h)) {
      r.breathing = body;
      continue;
    }
    if (/ストレッチ/.test(h)) {
      r.stretch = body;
      continue;
    }
    if (/ツボ/.test(h)) {
      r.tsubo = body;
      continue;
    }
    if (/漢方/.test(h)) {
      r.kampo = body;
      continue;
    }
  }
  return r;
}

function pickContext(context) {
  if (!context) {
    return {
      symptom: null, type: null, trait: null, flowType: null, organType: null, advice: null, created_at: null
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

module.exports = function buildConsultMessages({ context, followups, userText }) {
  const ctx = pickContext(context);
  const latest = followups?.latest ?? null; // 直近1件（全カラム）
  const prev   = followups?.prev   ?? null; // その前（全カラム）

  const system = [
    "あなたは『ととのうケアナビ』（東洋医学×AIセルフケア支援）の専門アドバイザーAI『トトノウくん』です。",
    "以下の“体質・所見（symptom/type/trait/flowType/organType/advice）”と“直近2回のととのい度チェック（全カラム）”を必ず参照して、ユーザーの相談に答えてください。",
    "",
    "▼ 体質・所見（contexts 直参照）",
    toJSON(ctx),
    "",
    "▼ ととのい度チェック（最新・全カラム）",
    toJSON(latest),
    "",
    "▼ ととのい度チェック（前回・全カラム）",
    toJSON(prev),
    "",
    "【回答方針】",
    "・上記の体質傾向と symptom、直近のチェック傾向を踏まえ、“今すぐ実行できる”行動提案を返すこと。",
    "・提案は 生活習慣／経絡ストレッチ／井穴・経穴ケア／呼吸法／おすすめ市販漢方 の範囲で、タイミング・回数・目安時間・注意点を具体的に。",
    "・専門用語は必要に応じて短く翻訳・補足すること。",
    "・『ととのうケアガイド』の丸写しは避け、応用・優先順位・実践の工夫に寄せること。",
    "・急性/重篤が疑われる場合は受診を促す。体質傾向と訴えが大きく乖離するなら、必要に応じて再評価（ととのえ方分析）を丁寧に提案。",
    "・出力はLINEで読みやすい短文＋改行中心（長文は小見出し＋箇条書き最小限）＋絵文字を適宜入れる＋。※不自然な記号（*や#など）は使わない。",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user",   content: (userText || "").trim() }
  ];
};
