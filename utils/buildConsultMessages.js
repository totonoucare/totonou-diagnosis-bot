// utils/buildConsultMessages.js
// AI相談用のプロンプト生成：contexts / followups / 直近チャット3件を参照。
// + フォローアップのスコアの「見方」を明示して、回答の一貫性と可読性を高める。

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

    if (/体質改善|習慣/.test(h))      { r.habits = body;    continue; }
    if (/呼吸/.test(h))                { r.breathing = body; continue; }
    if (/ストレッチ/.test(h))         { r.stretch = body;   continue; }
    if (/ツボ/.test(h))                { r.tsubo = body;     continue; }
    if (/漢方/.test(h))               { r.kampo = body;     continue; }
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

/** スコアの見方（followup/responseSender.js の仕様に基づく）
 * 数値は 1 が良好、数値が大きいほど「乱れが強い」。
 * Q3の柱は「継続 / 継続中 / 時々 / 未着手」で、左ほど実践できている。
 */
function buildScoreLegend() {
  const lines = [
    "▼ スコアの見方",
    "・数値スコア（1〜5）は 1 が良好、数値が大きいほど“乱れ”や“つらさ”が強い。",
    "・Q3〈習慣/呼吸法/ストレッチ/ツボ/漢方〉は段階評価（継続/継続中/時々/未着手）。左ほど実施できており、未着手が最も弱い。",
    "",
    "Q1: symptom_level（主訴のつらさ） … 1=軽い/支障なし ←→ 5=強い/生活に支障",
    "Q2: sleep（睡眠の乱れ） … 1=よく眠れている ←→ 5=かなり乱れている",
    "Q2: meal（食事の乱れ） … 1=整っている ←→ 5=かなり乱れている",
    "Q2: stress（ストレスの強さ） … 1=軽い ←→ 5=かなり強い",
    "Q3: habits（体質改善習慣） … 継続 / 継続中 / 時々 / 未着手",
    "Q3: breathing（呼吸法） … 継続 / 継続中 / 時々 / 未着手",
    "Q3: stretch（ストレッチ） … 継続 / 継続中 / 時々 / 未着手",
    "Q3: tsubo（ツボ） … 継続 / 継続中 / 時々 / 未着手",
    "Q3: kampo（漢方） … 継続 / 継続中 / 時々 / 未着手",
    "Q4: motion_level（動作のつらさ/ぎこちなさ） … 1=軽い/支障なし ←→ 5=強い/支障大",
  ];
  return lines.join("\n");
}

module.exports = function buildConsultMessages({ context, followups, userText, recentChats = [] }) {
  const ctx = pickContext(context);
  const latest = followups?.latest ?? null;
  const prev   = followups?.prev   ?? null;

  // 直近チャット（古→新、最大3件）。300字で軽くトリムして過大トークンを回避
  const chats = (recentChats || []).map(c => {
    const who = c.role === 'assistant' ? 'アシスタント' : 'ユーザー';
    const body = String(c.message || c.content || "").slice(0, 300);
    return `${who}: ${body}`;
  });

  const system = [
    "あなたは『ととのうケアナビ』（東洋医学×AIセルフケア支援）の専門アドバイザーAI『トトノウくん』です。",
    "以下の“体質・所見（symptom/type/trait/flowType/organType/advice）”と“直近2回のととのい度チェック”、そして“直近チャット3件”を踏まえて、ユーザーの相談に答えてください。",
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
    chats.length ? "▼ 直近の会話（古→新, 最大3件）\n" + chats.join("\n") : "",
    "",
    buildScoreLegend(), // ← 追加：スコアの見方
    "",
    "【回答方針】",
    "・上記の体質・所見、直近のととのい度チェックの傾向、最近の会話内容を踏まえ、ユーザーのタイプに寄り添った相談対応や行動提案を返すこと。",
    "・セルフケアの提案をする場合は adviceの内容（生活習慣／経絡ストレッチ／井穴・経穴ケア／呼吸法／おすすめ市販漢方）の範囲で、タイミング・回数・目安時間・注意点を具体的に。",
    "・adviceの内容の丸写しは避け、相談内容に応じた応用・優先順位・実践の工夫に寄せること。",
    "・専門用語は必要に応じて短く翻訳・補足すること。",
    "・急性/重篤が疑われる場合は受診を促す。体質傾向と訴えが大きく乖離するなら、必要に応じて再評価（ととのえ方分析）を丁寧に提案。",
    "・出力はLINEで読みやすい短文＋改行中心（長文は小見出し＋箇条書き最小限）＋絵文字を適宜入れる。※不自然な記号（*や#など）は使わない。",
  ].filter(Boolean).join("\n");

  return [
    { role: "system", content: system },
    { role: "user",   content: (userText || "").trim() }
  ];
};
