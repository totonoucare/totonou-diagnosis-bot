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
    "・同一日に同じケアを複数回行っても1回として扱われ、8日間で最大40回（5項目×8日）までが集計対象です。",
    "・これにより、ケア間の頻度差をなくし、行動データを安定的に評価できます。",
    "",
    "▼ スコア構成（followupsテーブル）",
    "symptom_level … 主訴の強さ。生活や仕事に支障を感じる程度。",
    "sleep … 睡眠の整い具合。",
    "meal … 食事リズム・食習慣の整い具合。",
    "stress … 精神的負担や過緊張の程度。",
    "motion_level … advice.stretchに記載された動作（該当経絡ラインの伸展動作）を行ったときのつらさ。",
    "",
    "▼ 因果構造（AIの推定指標）",
    "・habits ↔ sleep / meal / stress → symptom_level：",
    "　一次KPI＝sleep, meal, stress。体質改善習慣（habits）の継続は自律・代謝・リズムを整え、これらの生活指標を安定化させる。整うほど主訴（symptom_level）が緩和しやすい。",
    "",
    "・stretch / tsubo ↔ motion_level → symptom_level：",
    "　一次KPI＝motion_level。ストレッチやツボ刺激は筋膜・経絡ラインの“構造テンション”を調整し、動作時の痛みを軽減する。構造バランスが取れることで関連臓腑への負担も減少し、結果的に主訴が改善しやすくなる。",
    "",
    "・breathing → 構造バランス → symptom_level：",
    "　一次KPI＝構造安定（core pressure）。腹式呼吸（中脘あたりへの深い呼吸）によって腹圧と膜連動を整えることで、体幹テンセグリティ（張力構造バランス）が回復する。これが循環改善・副交感優位を促し、主訴の軽減を助ける。",
    "",
    "・kampo（補助線）：",
    "　他のセルフケアを一定期間継続しても改善が停滞する場合、補助的手段として用いられる。長期常用は推奨されない。",
    "",
    "▼ 総合整い度の構成（内部算出）",
    "・行動スコア（care_logs_daily由来）＝直近8日間のケア実施割合。",
    "・体調反映度（followups由来）＝前回比の体調改善度合い。",
    "・総合整い度 ＝ 行動40％＋反映度60％ で統合（星1〜5表示）。",
  ];
  return lines.join("\n");
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
    toJSON(careCounts),
    "",
    "（各ケア項目は1日1回扱い。直近8日間の実施数を集計しています）",
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
    "3) 表現はLINE向けに短く、300字程度を目安に。段落を分け、絵文字を適度に使ってやさしく伝える。専門用語はやさしく言い換える。",
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
