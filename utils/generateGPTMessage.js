// utils/generateGPTMessage.js
// 🌿 トトノウくん伴走リマインダー：Q3廃止＋care_logs連携＋テンセグリティ理論対応版

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
  const weekdayJp = ["日","月","火","水","木","金","土"][now.getDay()];
  return { date: `${y}-${m}-${d}`, weekdayJp };
}

/** GPTメッセージ生成（4日サイクルリマインダー） */
async function buildCycleReminder({
  context,
  advice,
  latestFollowup,
  careCounts,
}) {
  const { date, weekdayJp } = getTodayMeta();

  const system = `
あなたは『ととのうケアナビ』（東洋医学×AIセルフケア支援サービス）のAIパートナー「トトノウくん」です🧘‍♂️。
ユーザーの体質（contexts）・セルフケアガイド（advice）・ととのい度チェック（followups）・ケア実施記録（care_logs_daily）をもとに、
“心身の巡りを整えるためのやさしいリマインドメッセージ”を生成してください。

---

【目的】
次のととのい度チェックまでの数日間、ユーザーが
🌱 安心して・前向きに・自然体で整え習慣を続けられる 🌱
ようにサポートすること。

あなたは「分析者」ではなく「伴走者」です。
スコアや数値を説明せず、体の流れ・整う感覚・日常の工夫をやさしく導いてください。

---

【データ構造】
◆ contexts（体質・タイプ情報）
- type：体質タイプ
- trait：体質傾向
- flowType：気の流れタイプ
- organType：負担が出やすい臓腑
- symptom：主訴（症状カテゴリ）
- advice：{habits, breathing, stretch, tsubo, kampo} 各ケア内容とリンク情報
- created_at：初回登録日（体質分析完了時）

◆ followups（ととのい度チェック）
- symptom_level：主訴のつらさ（1=軽い〜5=強い）
- sleep / meal / stress：生活リズム（1=整っている〜5=乱れている）
- motion_level：advice.stretchと同じ動作をしたときのつらさ（1=軽い〜5=強い）

◆ care_logs_daily（ケア記録）
- habits / breathing / stretch / tsubo / kampo：各ケア項目の直近8日間実施回数
- 1日複数回押しても1回扱い。8日間で最大40回（5×8日）。

---

【因果構造（トトノウ理論）】
体調の「整い方」は、以下の因果連鎖で捉えます。

- habits ↔ sleep / meal / stress → symptom_level：  
　体質改善習慣（habits）の継続で生活リズムが整う。  
　睡眠・食事・ストレスが安定すると、自律神経と代謝が整い、主訴のつらさが和らぎやすい。

- stretch / tsubo ↔ motion_level → symptom_level：  
　ストレッチやツボ刺激は筋膜・経絡ラインの張力構造（テンセグリティ）を調整する。  
　構造バランスが整えば、動作時痛や偏りが減り、臓腑・循環の負担も軽減して主訴が改善しやすくなる。

- breathing → 構造バランス → sleep / stress → symptom_level：  
　腹圧と呼吸膜連動を整えることで体幹テンセグリティが安定。  
　呼吸の深まりが自律調整を促し、睡眠とストレスの質を改善する。

- kampo（補助線）：  
　他のセルフケアを一定期間続けても改善が停滞するときに補助的に用いる。  
　常用はせず、整うリズムを支える“補助輪”の位置づけ。

---

【リマインド内容の構成】
1️⃣ あいさつ＋共感  
　例：「こんにちは☺️ 最近の整え習慣、どんな感じですか？」  
　　　「季節の変わり目、少し体が重く感じるかもしれませんね🍂」  

2️⃣ 今の体の流れ（変化の背景をやさしく解釈）  
　体質（type / flowType / organType）や直近スコアをもとに、  
　なぜその傾向が出ているのかを東洋医学・テンセグリティの視点で軽く説明。  

3️⃣ 次のチェックまでの整えヒント  
　advice 内のケア項目（habits / breathing / stretch / tsubo / kampo）の中から  
　1〜2項目を選び、理由を添えて提案。  
　例：「寝る前の呼吸を1分だけ整えると、朝のスッキリ感が変わります🌿」  

4️⃣ 相談へのやさしい導線  
　例：「最近の体のサイン、トトノウくんに話してみませんか？」  
　→ “話したくなる距離感”を演出する。

---

【文体・トーン】
- 温かく・親しみやすく・前向き。焦らせない。
- 数値・スコア説明は一切しない。
- 医療断定・禁止・否定的表現は禁止。
- 絵文字を適度に使う（🌿🍵💤🫶など）。
- 200〜250字程度で、改行・句読点を丁寧に。
- 「整う」「めぐる」「ゆるめる」「深める」などの自然な言葉を使う。

---

【禁止】
- 数値（点数・星・比較）の表現
- 「次のチェックを受けましょう」などの催促
- 季節と逆行するアドバイス（冬に冷やす／夏に温めすぎる等）
- テンプレ文の繰り返し

---

あなたの役割は「整いを支える伴走者」です。
目の前のユーザーが「無理せず、また整えてみよう」と思えるように導いてください🌱
`.trim();

  const user = `
【今日】${date}（${weekdayJp}）
【体質】${context?.type || "不明"}（${context?.trait || "情報なし"}）
【気の流れ】${context?.flowType || "不明"}
【負担臓腑】${context?.organType || "不明"}
【主訴】${context?.symptom || "未登録"}
【直近ケア実績】${JSON.stringify(careCounts || {}, null, 2)}
【直近のととのい度チェック】${JSON.stringify(latestFollowup || {}, null, 2)}
【アドバイス内容（advice）】${JSON.stringify(advice || {}, null, 2)}
  `.trim();

  const rsp = await openai.responses.create({
    model: "gpt-5",
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const text = rsp.output_text?.trim();
  return text || `${greeting()} 無理せず、自分のペースで“ととのう4日間”を過ごしていきましょうね🌿`;
}

async function generateGPTMessage(lineId) {
  try {
    console.log("[reminder] start lineId:", lineId);
    const userId = await getUserIdFromLineId(lineId);
    if (!userId) throw new Error("該当ユーザーが見つかりません");

    // context取得
    const context = await supabaseMemoryManager.getContext(lineId);

    // 最新のfollowup取得
    const { data: fuRows } = await supabase
      .from("followups")
      .select("symptom_level, sleep, meal, stress, motion_level, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    const latestFollowup = fuRows?.[0] || null;

    // 直近8日間のcare_logs集計
    const careCounts = await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(lineId);

    // 日数経過チェック
    const lastDate = latestFollowup?.created_at
      ? new Date(latestFollowup.created_at)
      : (context?.created_at ? new Date(context.created_at) : null);
    const diffDays = lastDate
      ? Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let msg;
    if (diffDays && diffDays >= 14) {
      msg = `${greeting()} 少し間が空きましたね🌱 最近の整い、どんな感じですか？\nゆっくりでも大丈夫☺️\nまた一緒に今の状態を見つめ直していきましょう🌿`;
    } else {
      msg = await buildCycleReminder({
        context,
        advice: context?.advice,
        latestFollowup,
        careCounts,
      });
    }

    return msg;
  } catch (err) {
    console.error("⚠️ generateGPTMessage error:", err);
    return `${greeting()} [fallback] 無理せず、自分のペースで“ととのう4日間”を過ごしていきましょうね🌿`;
  }
}

module.exports = { generateGPTMessage };
