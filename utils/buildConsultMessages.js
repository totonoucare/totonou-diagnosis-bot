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

  // カルーセル配列 [{header, body, link}, ...] を5本柱に分類
  const r = { habits: null, breathing: null, stretch: null, tsubo: null, kampo: null };
  const arr = Array.isArray(advice) ? advice : [];

  for (const card of arr) {
    const header = String(card?.header || "");
    const body = String(card?.body || "");
    const link = String(card?.link || ""); // ← 🔸ここを追加
    const h = header;

    // 🔸リンクがある場合は本文の末尾に追記（GPTが参照できるように）
    const combined = link ? `${body}\n\n【図解リンク】${link}` : body;

    if (/体質改善|習慣/.test(h))             { r.habits = combined;    continue; }
    if (/巡りととのう呼吸法|呼吸/.test(h))     { r.breathing = combined; continue; }
    if (/経絡ストレッチ|ストレッチ/.test(h))   { r.stretch = combined;   continue; }
    if (/指先・ツボほぐし|ツボ/.test(h))       { r.tsubo = combined;     continue; }
    if (/おすすめ漢方薬|漢方/.test(h))        { r.kampo = combined;     continue; }
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

/** スコアの見方（因果ルールを明示：AIの推定を安定化）
 * 数値は 1 が良好、数値が大きいほど「乱れ・つらさ」が強い。
 * Q3の柱は「継続 / 継続中 / 時々 / 未着手」で、左ほど実践できている。
 * motion_level は「adviceのストレッチと同じ動きをした時の“伸展時のつらさ”」を数値化したもの。
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
    "Q4: motion_level（“adviceのストレッチ”と同じ動きをした時のつらさ） … 1=軽い/支障なし ←→ 5=強い/支障大",
    "　※「同じ動き」とは、contexts.advice.stretch に記載されたあなた専用ストレッチ（＝該当の経絡ラインを伸ばす動作）を再現したときの“伸展時のつらさ”を指します。",
    "",
    "▼ 因果の見方（AIが推定に使う一次KPIと二次効果）",
    "・habits ↔ sleep / meal / stress → symptom_level：",
    "　一次KPI＝sleep/meal/stress。habitsの実践は生活リズムを整えやすく、逆に乱れはhabits実践を阻害しやすい。生活リズムが整うと二次効果として symptom_level が下がりやすい。",
    "・stretch / tsubo ↔ motion_level → symptom_level：",
    "　一次KPI＝motion_level（＝advice.stretch と同じ動きをしたときの伸展時のつらさ）。該当経絡へのストレッチ/ツボが効けば動作時痛が下がり、経絡・関連臓腑の負担が軽減して結果的に symptom_level も改善しやすい。motion_level の悪化は stretch/tsubo 未実施や負荷過多のサイン。",
    "・breathing → sleep / stress → symptom_level：",
    "　一次KPI＝sleep/stress。鳩尾〜臍（中脘あたり）に息を入れる腹式呼吸で腹圧・深層呼吸筋・内臓を賦活し、自律調整が働いて sleep / stress を整え、最終的に symptom_level の改善を後押しする。",
    "・kampo（補助線）：",
    "　他の柱が一定以上できていても symptom_level / motion_level が停滞する時の候補。常用はせず、最終手段として検討。",
    "",
    "▼ 解釈のヒント（優先度の決め方の例）",
    "・motion_level が高い かつ stretch/tsubo が「時々・未着手」→ まず stretch/tsubo を優先。",
    "・sleep/meal/stress が複数で高い かつ habits が「時々・未着手」→ habits を優先。",
    "・sleep または stress が高い かつ breathing が「時々・未着手」→ breathing を優先。",
    "・3〜4回のチェックで実施度は良好（継続/継続中）なのに症状が停滞 → kampo を候補に（用量・頻度や負荷の見直しも併記）。",
  ];
  return lines.join("\n");
}
// utils/buildConsultMessages.js（抜粋・置き換え）

module.exports = function buildConsultMessages({ context, followups, userText, recentChats = [] }) {
  const ctx = pickContext(context);
  const latest = followups?.latest ?? null;
  const prev   = followups?.prev   ?? null;

  // 直近チャットを role 付きで messages に渡す（古→新、最大3件、各300字）
  const chatHistory = (recentChats || [])
    .slice(-3) // 念のため最大3件に
    .map(c => {
      const role = c?.role === 'assistant' ? 'assistant' : 'user';
      const content = String(c?.message ?? c?.content ?? '').slice(0, 300);
      if (!content) return null;
      return { role, content };
    })
    .filter(Boolean);

  // system用のヘッダ（※「直近の会話」はここに入れない）
  const systemHeader = [
    "あなたは『ととのうケアナビ』（東洋医学×AIセルフケア支援サービス）のウェルネスパートナーAI『トトノウくん』です。",
    "以下の“体質・所見（symptom/type/trait/flowType/organType/advice）”と“直近2回のととのい度チェック”、そして“直近会話（messages 配列の過去発話）”を踏まえて、ユーザーの相談に親身に答えてください。",
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
    buildScoreLegend(),
    "",
    "【回答方針】",
    "1) 体質・所見（contexts）と、ととのい度チェック（latest/prev）・直近会話を踏まえ、",
    "   今のユーザーの状況や相談内容に沿った具体的アドバイスを提示(相談内容がadviceの内容で答えられない場合は、GPTの知識から回答してもOK。)",
    "   東洋医学的な理解が必要そうな相談の場合には簡単に噛み砕いて答える。",
    "2) 回答後、必要であれば “質問内容に派生・関連する提案（任意）” を追加提案してよい：",
    "   例）食事（1食の献立/代替食/避ける食材）、買い物（食材/常備品/サプリの候補と理由）",
    "       ストレスや困り事などの相談を聞いてあげる、生活設計（睡眠・運動・入浴の順番/時間）",
    "3) 表現ルール：LINE向けに短文(多くても300字まで＋段落分けで見やすく。絵文字も使用し温かく優しく寄り添う口調で。専門語は短く訳す。)",
    "   見出しや箇条書きには、適切な絵文字や記号を使い、LINE上で読みやすく表現する。",
    "   adviceにURL(図解リンク)がある場合は極力載せる。※ただし、Markdownではなく、「https://〜」形式で書いてください。LINEが自動でリンク化します。",
    "4) セーフティ：西洋医学的な診断・処方はしない。急性/重篤の兆候は受診案内を優先。",
    "5) 推奨の粒度：費用/手間は現実的に。セルフケアやセルフメディケーション(OTC漢方薬や栄養サプリ)の範囲内で。",
    "6) 『今週のケアプラン』を求められた場合は、以下の構成で提示する：",
    "   ・今週のポイント：ユーザーの体質やととのい度チェック結果（因果意識）や季節(直近の気候)の様子から、今週はどんなことを目標にして取り組むべきかを理由とともに提示。(数字は使わず噛み砕いて)",
    "   ・毎日ケア：体質と直近の「ととのい度チェック」の結果に応じて最も優先すべきadvice内容1〜2つ",
    "   ・週2〜3日は取り組みたいケア：直近の「ととのい度チェック」の結果から、毎日ケアの次に必要優先度の高いadvice内容1つ",
  ].filter(Boolean).join("\n");

  // ← ここが肝心：system に long テキスト、続けて直近会話、最後に今回のユーザー発話
  return [
    { role: "system", content: systemHeader },
    ...chatHistory,
    { role: "user", content: String(userText || "").trim() }
  ];
};
