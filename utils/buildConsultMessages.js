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

    if (/体質改善|習慣/.test(h))             { r.habits = body;    continue; }
    if (/巡りととのう呼吸法|呼吸/.test(h))     { r.breathing = body; continue; }
    if (/経絡ストレッチ|ストレッチ/.test(h))   { r.stretch = body;   continue; }
    if (/指先・ツボほぐし|ツボ/.test(h))       { r.tsubo = body;     continue; }
    if (/おすすめ漢方薬|漢方/.test(h))        { r.kampo = body;     continue; }
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
 * motion_level は「その人に提案している stretch（特定動作）そのもののつらさ」を数値化したもの。
 */
function buildScoreLegend() {
  const lines = [
    "▼ ととのい度チェックとは？",
    "・『症状の強さ（symptom_level / motion_level）』と『生活リズム（sleep / meal / stress）』を数値で自己申告。",
    "・同時に、提案セルフケア（habits / breathing / stretch / tsubo / kampo）の実施度を「継続〜未着手」で申告。",
    "・つまり『症状の変化（数値）』×『セルフケア実施度（段階）』をペアで記録し、改善の手応えを見える化する仕組み。",
    "",
    "▼ スコアの見方",
    "・数値スコア（1〜5）は 1 が良好、数値が大きいほど“乱れ”や“つらさ”が強い。",
    "・Q3〈habits / breathing / stretch / tsubo / kampo〉は段階評価（継続 / 継続中 / 時々 / 未着手）。左ほど実施できている。",
    "",
    "Q1: symptom_level（主訴のつらさ） … 1=軽い/支障なし ←→ 5=強い/生活に支障",
    "Q2: sleep（睡眠の乱れ） … 1=整っている ←→ 5=かなり乱れている",
    "Q2: meal（食事の乱れ） … 1=整っている ←→ 5=かなり乱れている",
    "Q2: stress（ストレスの強さ） … 1=軽い ←→ 5=かなり強い",
    "Q3: habits（体質改善習慣） … 継続 / 継続中 / 時々 / 未着手",
    "Q3: breathing（巡りととのう呼吸法） … 継続 / 継続中 / 時々 / 未着手",
    "Q3: stretch（経絡ストレッチ） … 継続 / 継続中 / 時々 / 未着手",
    "Q3: tsubo（指先・ツボほぐし） … 継続 / 継続中 / 時々 / 未着手",
    "Q3: kampo（おすすめ漢方薬） … 継続 / 継続中 / 時々 / 未着手",
    "Q4: motion_level（負担経絡の伸展動作のつらさ） … 1=軽い/支障なし ←→ 5=強い/支障大",
    "　※ここでの『負担経絡の伸展動作』は、その人に提案している stretch の動きそのもの。",
    "",
    "▼ 項目どうしの関係（AIはここを意識して因果を推定）",
    "・habits ↔ sleep / meal / stress：habitsの実践は生活リズム（睡眠・食事・ストレス）を整えやすく、逆に生活リズムの乱れはhabits実践を阻害しやすい。",
    "・stretch / tsubo ↔ motion_level：この2つのセルフケアは、motion_level（特定動作のつらさ）の低下に“直接”効く想定。motion_levelの悪化は、stretch/tsubo未実施や負荷過多のサインになりやすい。",
    "・breathing は自律調整の底上げ要素として働きやすく、sleep・stress・symptom_level の改善を後押しすることが多い。",
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
    "あなたは『ととのうケアナビ』（東洋医学×AIセルフケア支援サービス）のウェルネスパートナーAI『トトノウくん』です。",
    "以下の“体質・所見（symptom/type/trait/flowType/organType/advice）”と“直近2回のととのい度チェック”、そして“直近チャット3件”を踏まえて、ユーザーの相談に親身に答えてください。",
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
    "1) まずはユーザーの質問に端的に答える（結論→理由→やること）。",
    "2) 体質・所見（contexts）と、ととのい度チェック（latest/prev）・直近会話を踏まえ、",
    "   “今のユーザーの状況に沿った具体的アドバイスを提示(adviceの内容と大きくズレがなければ、advice以外の内容でもOK。)",
    "3) 回答後、必要であれば “質問内容に派生・関連する提案（任意）” を追加提案してよい：",
    "   例）食事（1食の献立/代替食/避ける食材）、買い物（食材/常備品/サプリの候補と理由）",
    "       ストレスや困り事などの相談を聞いてあげる、生活設計（睡眠・運動・入浴の順番/時間）",
    "   ※ 提案は “いまのスコアと体質” に直結する根拠をひと言添える。押しつけず、選択式にする。",
    "   提案の出し方例：『必要なら○○もご提案できます（要りますか？)』",
    "4) 表現ルール：LINE向けに短文（200文字前後）＋改行で見やすく。絵文字も使用し温かく優しく寄り添う口調で。専門語は短く訳す。",
    "5) セーフティ：西洋医学的な診断・処方はしない。急性/重篤の兆候は受診案内を優先。",
    "6) 推奨の粒度：ブランド名は原則出さない（求められたら候補を比較）。費用/手間は現実的に。",
    "7) 因果の意識：",
    "   ・habits ↔ sleep/meal/stress を調整、breathing は鳩尾〜臍での腹式呼吸により、自律調整の底上げや腹圧に関わる深層筋や内臓の活性で体全体のバランス調整アプローチ",
    "   ・stretch/tsuboは、motion_level（＝その人に提案しているstretch(経絡ラインのストレッチ)と同様の伸展動作時のつらさ）を直接下げる目的であり、その人の負担経絡(関連五臓六腑)を改善する想定",
    "8) 出力構成：",
    "   ・冒頭に結論1〜2行 → 箇条書きで手順（いつ/どこで/どれだけ/どうやって/注意点）",
    "   ・最後に “必要なら…” の追加提案（最大2件、Yes/No選べる書き方）",
  ].filter(Boolean).join("\n");

  return [
    { role: "system", content: system },
    { role: "user",   content: (userText || "").trim() }
  ];
};
