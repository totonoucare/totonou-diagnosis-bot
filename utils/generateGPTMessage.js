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
    "・habits ↔ sleep / meal / stress：生活リズム（睡眠・食事・ストレス）は habits の実践度に強く影響し、逆に habits を整えるとこれらの乱れも改善しやすい。",
    "・stretch / tsubo ↔ motion_level：stretch / tsubo は motion_level（動作テストの経絡ライン張りや負担）を直接下げる目的のセルフケア。motion_level の悪化は stretch / tsubo の未実施や負荷過多を示唆する。",
    "・breathing ↔ stress / sleep：breathing（巡りととのう呼吸法）は自律神経と深層呼吸筋を整え、ストレス緩和や睡眠改善を助ける。"
  ];
  return lines.join("\n");
}


function extractStatusFlag(fu = null) {
  if (!fu) return null;

  const n = v => (v == null ? null : Number(v));
  const s = v => (v == null ? "" : String(v).trim());
  const flags = [];

  // --- Q1/Q2: スコア傾向
  if (n(fu.symptom_level) >= 4) flags.push("不調のつらさが強め");
  if (n(fu.motion_level) >= 4)  flags.push("動作時の張りが強い");
  if (n(fu.sleep) >= 4)         flags.push("睡眠が乱れ気味");
  if (n(fu.meal) >= 4)          flags.push("食事リズムが乱れ気味");
  if (n(fu.stress) >= 4)        flags.push("ストレスが強め");

  // --- Q3: 実施状況
  const careStates = [s(fu.habits), s(fu.breathing), s(fu.stretch), s(fu.tsubo), s(fu.kampo)];
  const unstarted = careStates.filter(v => v.includes("未着手")).length;
  const sometimes = careStates.filter(v => v.includes("時々")).length;
  const ongoing = careStates.filter(v => v.includes("継続中")).length;

  if (unstarted >= 3) flags.push("セルフケアはこれからの段階");
  else if (sometimes >= 3) flags.push("ケアが少し途切れがち");
  else if (ongoing >= 3) flags.push("ケアが安定している");

  if (flags.length === 0) return "全体的に安定している様子";
  return flags.join("・");
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
ユーザーの体質（context）、ととのうケアガイド（advice）、そして直近のととのい度チェック（followups）をもとに、
次の4日間を前向きに過ごせるように“気持ちを整えるリマインドメッセージ”を届けてください。

【あなたの役割】
- ユーザーにはすでに『ととのい度チェック』の分析メッセージ（Flex形式）が別途届いています。
- そのため、分析やスコアの説明を重ねず、ユーザーの“気持ち”や“取り組み姿勢”を支える言葉を中心にしてください。
- あなたは分析者ではなく、伴走者・応援者の立場です🌱

【目的】
- 「次のチェックまでの4日間」をどう過ごせばいいか、前向きなヒントを与える
- うまくできていなくても責めず、安心感と再開のきっかけを届ける
- 続けられている人には、成果や積み重ねを温かく認め、モチベーションを維持させる
- 体質・advice・スコア傾向を踏まえつつ、生活のリズムを整えやすくする提案を行う

【出力構成】
1️⃣ あいさつ＋共感  
　例：「こんにちは☺️ 最近の整え習慣、どんな感じですか？」  
　　「少し疲れが残りやすい時期かもしれませんね🍂」  
2️⃣ 今週（次の4日間）の過ごし方ヒント  
　体質（type / flowType / organType）やadvice内容を反映し、テーマを1つに絞って提案  
3️⃣ 小さな行動や休息の提案  
　すぐできる行動を優しく伝える  
4️⃣ AI相談への自然な導線  
　例：「最近の体のサインやセルフケアの手応え、トトノウくんに話してみませんか？」  
　※末尾で“会話したくなる距離感”を演出する

【トーンと文体】
- 温かく、フレンドリーで、優しく寄り添う  
- 医療断定・強制・否定表現は禁止  
- 句読点や改行をこまめに入れ、LINEで読みやすいリズムに  
- 文字数は200〜250字前後  
- 絵文字は適度に使い、感情に寄り添う  
- 専門用語は使わず、自然な日本語で「心身の巡り」や「整える」などの表現を中心に

【体質別セルフケア（ととのうケアガイド：advice）】
- habits（体質改善習慣） … リズム・食・睡眠の軸
- breathing（巡りととのう呼吸法） … 自律神経や内臓の調整
- stretch（経絡ストレッチ） … 負担経絡の改善
- tsubo（ツボほぐし） … 末端から巡りを促す
- kampo（おすすめ漢方薬） … 最終的な補助提案（他のケアよりも優先度は低く）

これらの内容を踏まえ、「今週は〇〇を意識してみましょう」のように自然に触れてください。

【スコアの見方】
${buildScoreLegend()}

【禁止】
- スコア変化の説明（例：「前回より-10点」など）を行わない
- 「次のチェックを受けましょう」などの催促を行わない
- 医療行為・診断・薬剤の断定的な表現は禁止
- 季節や気候にそぐわない提案（例：冬に体を冷ます、夏に冷たい食事を控えるような指示など）は禁止。
- 提案を行う際は「今の季節（日本の四季）」を前提にし、極端な冷温・乾湿の助言は避けること。
- 「体質分析結果に書かれたテンプレ文」を機械的に繰り返さず、季節の文脈と調和させた自然な整え方に調整する。

目的は、4日後のチェックに向けて
「また少し頑張ってみよう」と思える“心の整えメッセージ”を届けることです🌿
`.trim();

  const user = `
【今日】${date}（${weekdayJp}）
【体質】${constitution || "不明"}（${trait || "情報なし"}）
【気の流れ】${flowType || "不明"}
【負担臓腑】${organType || "不明"}
【主訴】${chiefSymptom || "未登録"}
【ととのうケアガイド】${advice ? JSON.stringify(advice) : "未登録"}
【直近のととのい度チェック】${latest ? JSON.stringify(latest) : "なし"}
【状態】${statusFlag || "全体的に安定している様子"}
  `.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
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
      .limit(1);
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
