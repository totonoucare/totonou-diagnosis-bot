// utils/generateGPTMessage.js
// 🌿 トトノウくん伴走リマインダー：
// - Responses API版
// - legend_v1 / structure_v1 共有
// - モチベ＋リスク予兆＋季節アドバイス対応

const { OpenAI } = require("openai");
const { createClient } = require("@supabase/supabase-js");
const { getUserIdFromLineId } = require("./getUserIdFromLineId");
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const supabaseMemoryManager = require("../supabaseMemoryManager");

// 🧠 AIチャット本体と共通の定義ブロック
const legend_v1 = require("./cache/legend_v1");
const structure_v1 = require("./cache/structure_v1");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function greeting() {
  return "こんにちは☺️";
}

function getTodayMeta() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const weekdayJp = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
  return { date: `${y}-${m}-${d}`, weekdayJp, month: now.getMonth() + 1 };
}

/** オブジェクトを安全にJSON文字列化 */
function toJSON(obj) {
  try {
    return JSON.stringify(obj ?? null, null, 2);
  } catch {
    return JSON.stringify({ _error: "unserializable" }, null, 2);
  }
}

/** GPTメッセージ生成（4日サイクルリマインダー） */
async function buildCycleReminder({ context, advice, latestFollowup, careCounts }) {
  const { date, weekdayJp, month } = getTodayMeta();

  // 🌸 季節のざっくりラベル（日本前提のゆるい区分）
  let seasonLabel = "季節の変わり目";
  if (month === 12 || month === 1 || month === 2) seasonLabel = "冬";
  else if (month >= 3 && month <= 5) seasonLabel = "春";
  else if (month >= 6 && month <= 8) seasonLabel = "夏";
  else if (month >= 9 && month <= 11) seasonLabel = "秋";

  // ====== system プロンプト ======
  const system = `
あなたは『ととのうケアナビ』（東洋医学×AIセルフケア支援サービス）のAIパートナー「トトノウくん」です🧘‍♂️

下記はサービス全体の考え方やデータ構造の説明です（参照用）：

${legend_v1}

${structure_v1}

---

## 🔸 これは「レターリマインド専用モード」です

- 役割：
  - ユーザーの体質・ととのい度チェック・ケアログをもとに、
    4日前後のサイクルで「やさしいお手紙風リマインド」を送る。
  - 目的は「モチベーション・継続のコーチング」「リスク予兆のやわらかな可視化」「季節に合わせた微調整アドバイス」。

---

## 🔸 出力ルール（レター用の上書き仕様）

- 日本語で、200〜260文字くらいの「短い手紙」のように書く。
- 3〜5行程度に適度に改行を入れて、LINEで読みやすくする。
- 数値・スコア・星・点数などは一切出さない（「前より少しラク」「負担がたまりやすい」といった言い方にする）。
- 「次のととのい度チェックを受けてください」など、チェック受検の催促はしない。
- 医療的な診断・病名・重いリスクの断定はしない。
  - 「病気になる」「危険」「○○症の可能性」などは避け、
    「このあたりに負担がたまりやすい時期かも」程度のやわらかい表現にする。
- 絵文字を適度に（🌿🫶🍵💤など）入れる。
- 体調が揺れやすい人を責めず、「今できていること」を必ず一つは認める。

---

## 🔸 レターの構成

1. あいさつ＋共感：
   - 今日の日付と季節感をうっすら意識しながら、
     「${seasonLabel}はこんな負担が出やすいね」「ここ最近、こんな体感が出やすいかも」など、共感から入りなさい。

2. からだの流れの今の傾向：
   - contexts（type / flowType / organType / symptom）と
     直近のととのい度チェック(latestFollowup)・ケアログ(careCounts)をもとに、
     「ここが整ってきている」「ここに少し負担が残りやすそう」といった
     “今の流れ” を1〜2文でやさしく説明する。
   - ここで「リスク予兆」を扱う場合は、
     「このままだと〇〇まわりに疲れがたまりやすいゾーンかも」
     のように、あくまで *手前のゾーン* としてふわっと伝える。

3. 次の数日間に意識したい一歩：
   - advice（habits / breathing / stretch / tsubo / kampo）と
     careCounts を参考に、
     1〜2個だけ「これを軽く意識してみよう」という提案をする。
   - すでによくできているケア（careCounts が多い）は、
     「その調子で」「無理ない範囲で続けてみようね」と維持を励ますトーンにする。
   - 新しく勧めるケアは、ハードルを極力下げる。
     （例：「寝る前1〜2回だけ深めの呼吸をしてみる」「朝イチに肩周りをゆっくり1回だけ回す」など）

4. 相談へのやさしい導線（1文でOK）：
   - 「もし最近の体のサインを詳しく整理したくなったら、いつでもトトノウくんにメッセージしてね🌿」
     のように、AI相談があることを “軽く思い出してもらう” 一文を添える。
`.trim();

  // ====== user コンテキスト（事実情報だけを渡す） ======
  const user = `
【今日】${date}（${weekdayJp}）
【推定季節】${seasonLabel}
【体質contexts】${toJSON(context || null)}
【直近のととのい度チェック】${toJSON(latestFollowup || null)}
【直近のケア実施日数】${toJSON(careCounts || {})}
【アドバイス内容（advice）】${toJSON(advice || {})}
`.trim();

  // Responses API 用に、consult と同じスタイルでまとめる
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const promptText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const rsp = await openai.responses.create({
    model: "gpt-5.1",
    input: promptText,
    reasoning: { effort: "low" },
    text: { verbosity: "low" },
  });

  const text = rsp.output_text?.trim();
  return (
    text ||
    `${greeting()} 無理せず、自分のペースで“ととのう数日間”を過ごしていきましょうね🌿`
  );
}

async function generateGPTMessage(lineId) {
  try {
    console.log("[reminder] start lineId:", lineId);
    const userId = await getUserIdFromLineId(lineId);
    if (!userId) throw new Error("該当ユーザーが見つかりません");

    // context取得
    const context = await supabaseMemoryManager.getContext(lineId);

    // 最新のfollowup取得（1件）
    const { data: fuRows, error: fuErr } = await supabase
      .from("followups")
      .select("symptom_level, sleep, meal, stress, motion_level, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fuErr) {
      console.warn("followups取得エラー:", fuErr.message);
    }

    const latestFollowup = fuRows?.[0] || null;

    // 直近期間のケア実施日数（shortTerm）
    const careCounts =
      await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(
        lineId
      );

    // 日数経過チェック（14日以上空いているか）
    const lastDate = latestFollowup?.created_at
      ? new Date(latestFollowup.created_at)
      : context?.created_at
      ? new Date(context.created_at)
      : null;

    const diffDays = lastDate
      ? Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let msg;
    if (diffDays && diffDays >= 14) {
      // 🕊 大きく間が空いたときは、まずはシンプルな声かけだけ
      msg = `${greeting()} 少し間が空きましたね🌱 最近の整い、どんな感じですか？\nゆっくりでも大丈夫☺️\nまた一緒に今の状態を見つめ直していきましょう🌿`;
    } else {
      // 通常サイクルの伴走レター
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
    return `${greeting()} [fallback] 無理せず、自分のペースで“ととのう数日間”を過ごしていきましょうね🌿`;
  }
}

module.exports = { generateGPTMessage };
