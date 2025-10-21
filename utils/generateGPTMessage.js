// utils/generateGPTMessage.js
// 🌿 トトノウくん伴走リマインダー：体質＋advice＋ととのい度チェック対応 完全版

const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const { getUserIdFromLineId } = require("./getUserIdFromLineId");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function greeting() {
  return "こんにちは☺️";
}

function getTodayMeta() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const date = `${y}-${m}-${d}`;
  const weekdayJp = ["日","月","火","水","木","金","土"][now.getDay()];
  return { date, weekdayJp };
}

/** スコアの見方（buildConsultMessages.jsから移植） */
function buildScoreLegend() {
  const lines = [
    "▼ ととのい度チェックとは？",
    "・『症状の強さ（symptom_level / motion_level）』と『生活リズム（sleep / meal / stress）』を数値で自己申告。",
    "・同時に、セルフケアとして提案した、ととのうケアガイド（habits / breathing / stretch / tsubo / kampo）の実施度を「継続〜未着手」で申告。",
    "・つまり『症状の変化（数値）』×『セルフケア実施度（段階）』をペアで記録し、改善の手応えを見える化する仕組み。",
    "",
    "▼ スコアの見方",
    "・数値スコア（1〜5）は 1 が良好、数値が大きいほど“乱れ”や“つらさ”が強い。",
    "・Q3〈habits / breathing / stretch / tsubo / kampo〉は段階評価（継続中 / 時々 / 未着手）。左ほど実施できている。",
    "",
    "Q1: symptom_level（不調(整えたい悩み)のつらさ） … 1=軽い/支障なし ←→ 5=強い/生活に支障",
    "Q2: sleep（睡眠の乱れ） … 1=整っている ←→ 5=かなり乱れている",
    "Q2: meal（食事の乱れ） … 1=整っている ←→ 5=かなり乱れている",
    "Q2: stress（ストレスの強さ） … 1=軽い ←→ 5=かなり強い",
    "Q3: habits（体質改善習慣） … 継続中 / 時々 / 未着手",
    "Q3: breathing（巡りととのう呼吸法） … 継続中 / 時々 / 未着手",
    "Q3: stretch（経絡ストレッチ） … 継続中 / 時々 / 未着手",
    "Q3: tsubo（指先・ツボほぐし） … 継続中 / 時々 / 未着手",
    "Q3: kampo（おすすめ漢方薬） … 継続中 / 時々 / 未着手",
    "Q4: motion_level（負担経絡の伸展動作のつらさ） … 1=軽い/支障なし ←→ 5=強い/支障大",
    "　※ここでの『負担経絡の伸展動作』は、その人に提案している stretch の動きそのもの。",
    "",
    "▼ 項目どうしの関係",
    "・habits ↔ sleep / meal / stress：生活習慣を整えると体調も整いやすい。",
    "・stretch / tsubo ↔ motion_level：動作テストの張りをとって経絡の負担(関連臓腑)を改善するセルフケア。",
    "・breathing ↔ stress / sleep：呼吸を整えると心身のリズムや睡眠の質も整う。",
  ];
  return lines.join("\n");
}


function extractStatusFlag(fu = null) {
  if (!fu) return null;

  const n = v => (v == null ? null : Number(v));
  const s = v => (v == null ? "" : String(v).trim());

  // --- Q1・Q2群：数値スコア評価（1=良好, 5=乱れ強）
  if (n(fu.symptom_level) >= 4) return "不調のつらさがやや強いようです";
  if (n(fu.motion_level) >= 4)  return "動作時の張りやつらさが少し強いようです";
  if (n(fu.sleep) >= 4)         return "睡眠リズムが乱れ気味です";
  if (n(fu.meal) >= 4)          return "食生活が少し乱れ気味のようです";
  if (n(fu.stress) >= 4)        return "ストレスが少し強く出ているようです";

  // --- Q3群：セルフケア実施度（継続中 / 時々 / 未着手）
  const careStates = [
    s(fu.habits),
    s(fu.breathing),
    s(fu.stretch),
    s(fu.tsubo),
    s(fu.kampo),
  ];

  // 「未着手」や「時々」が多いほど “ケアがまだ安定していない” と判断
  const countUnstarted = careStates.filter(v => v.includes("未着手")).length;
  const countSometimes = careStates.filter(v => v.includes("時々")).length;
  const countOngoing   = careStates.filter(v => v.includes("継続中")).length;

  if (countUnstarted >= 3) return "セルフケアはまだこれからの段階です";
  if (countSometimes >= 3) return "ケアが少し途切れがちな様子です";
  if (countOngoing >= 3)   return "コツコツ取り組めているようです";

  // --- 特に問題がなければ null
  return null;
}

/** GPTメッセージ生成：4日サイクルに合わせた伴走リマインド */
async function buildCycleReminder({
  constitution,
  trait,
  flowType,
  organType,
  chiefSymptom,
  advice,
  latest,
  statusFlag
}) {
  const { date, weekdayJp } = getTodayMeta();

  const system = `
あなたは『ととのうケアナビ』のAIパートナー「トトノウくん」です。
ユーザーの体質（context）・ととのうケアガイド（advice）・ととのい度チェック（followups）をもとに、
4日後の次回ととのい度チェックに向けて「今週の整え方」を優しくサポートする伴走メッセージを届けてください。

【目的】
- 「次のチェックまでにどう過ごせば整いやすいか」を伝える
- 催促や評価ではなく、ユーザーの努力や日常に寄り添う
- 今の状態が良くても悪くても、受け取って前向きになれる言葉にする

【出力構成】
1. あいさつ＋共感（親しみやすく、絵文字使用）
2. 今週（次の4日間）の過ごし方のヒント（体質やスコア傾向、advice内容から）
3. 小さな励ましや「自分を大切にする」提案
4. AI相談への自然な導線（例：「セルフケアや健康について困り事はないですか？？」「なんでも気軽に話してくださいね☺️」）
- 「次のチェックまでの4日間」「今週の整え方」といった表現を1回含める
- 医療断定や催促は禁止
- 文字数は300〜350字

【体質別セルフケア提案：ととのうケアガイド（advice）】
- habits（体質改善習慣）
- breathing（巡りととのう呼吸法）
- stretch（経絡ストレッチ）
- tsubo（ツボほぐし）
- kampo（おすすめ漢方薬）
これらの内容を踏まえ、どのセルフケアをどう意識すると良いかを自然に織り交ぜて声かけをしてください。
※ただし、漢方薬に関しては他のケア内容より優先度を低くし、最終手段として位置付けること。

${buildScoreLegend()}
  `.trim();

  const user = `
【今日】${date}（${weekdayJp}）
【体質】${constitution || "不明"}（${trait || "情報なし"}）
【気の流れ】${flowType || "不明"}
【負担臓腑】${organType || "不明"}
【主訴】${chiefSymptom || "未登録"}
【ととのうケアガイド】${advice ? JSON.stringify(advice) : "未登録"}
【直近のととのい度チェック】${latest ? JSON.stringify(latest) : "なし"}
【状態】${statusFlag || "特記なし"}
  `.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  return text || `${greeting()} 無理せず、自分のペースで“ととのう4日間”を過ごしていきましょうね🌿`;
}

async function generateGPTMessage(lineId) {
  try {
    console.log("[reminder] start lineId:", lineId);
    const userId = await getUserIdFromLineId(lineId);
    if (!userId) throw new Error("該当ユーザーが見つかりません");

    // context取得（adviceも含める）
    const { data: ctxRows } = await supabase
      .from("contexts")
      .select("type, trait, flowType, organType, symptom, advice, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    const mmContext = await supabaseMemoryManager.getContext(lineId) || {};
    const latestContext = ctxRows?.[0] || {};
    const constitution = latestContext?.type || mmContext?.type || null;
    const trait = latestContext?.trait || mmContext?.trait || null;
    const flowType = latestContext?.flowType || mmContext?.flowType || null;
    const organType = latestContext?.organType || mmContext?.organType || null;
    const chiefSymptom = latestContext?.symptom || mmContext?.symptom || null;
    const advice = latestContext?.advice || mmContext?.advice || null;

    // followups取得（最新のみ）
    const { data: fuRows } = await supabase
      .from("followups")
      .select("symptom_level, sleep, meal, stress, habits, breathing, stretch, tsubo, kampo, motion_level, created_at, id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(2);
    const latestFollowup = fuRows?.[0] || null;
    const statusFlag = extractStatusFlag(latestFollowup);

    // 2週間経過チェック
    const now = new Date();
    const lastCheckDate = latestFollowup
      ? new Date(latestFollowup.created_at)
      : (latestContext?.created_at ? new Date(latestContext.created_at) : null);
    const diffDays = lastCheckDate
      ? Math.floor((now - lastCheckDate) / (1000 * 60 * 60 * 24))
      : null;

    let msg;
    if (diffDays && diffDays >= 14) {
      msg = `${greeting()} 少し間が空きましたね🌱 最近の整い、どんな感じですか？\nゆっくりでも大丈夫☺️\nまた一緒に今の状態を見つめ直していきましょう🌿`;
    } else {
      msg = await buildCycleReminder({
        constitution,
        trait,
        flowType,
        organType,
        chiefSymptom,
        advice,
        latest: latestFollowup,
        statusFlag,
      });
    }

    return msg;
  } catch (error) {
    console.error("⚠️ generateGPTMessage error:", error);
    return `${greeting()} [fallback] 無理せず、自分のペースで“ととのう4日間”を過ごしていきましょうね🌿`;
  }
}

module.exports = { generateGPTMessage };
