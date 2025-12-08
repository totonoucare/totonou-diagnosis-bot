// utils/generateGPTMessage.js
// 🌿 ととのうケアナビ：からだの波レター（リマインド用 GPT）

const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const { getUserIdFromLineId } = require("./getUserIdFromLineId");
const supabaseMemoryManager = require("../supabaseMemoryManager");

// 体質・チェック構造の説明
const legend_v1 = require("./cache/legend_v1");
const structure_v1 = require("./cache/structure_v1");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
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
  return { date: `${y}-${m}-${d}`, weekdayJp };
}

/** GPTメッセージ生成（4日サイクルリマインダー） */
async function buildCycleReminder({
  context,
  latestFollowup,
  prevFollowup,
  careCounts,
}) {
  const { date, weekdayJp } = getTodayMeta();

  const system = `
あなたは『ととのうケアナビ』（東洋医学×AIセルフケア支援サービス）のAIパートナー「トトノウくん」です。

利用者の体質データ（contexts）、ととのい度チェック（followups）、ケア実施記録（care_logs_daily）をもとに、
「いま体がどんな波の位置にいるか」「どこが崩れやすいポイントか」をわかりやすく言語化した短いレターを作ってください。

数値の説明や行動指示ではなく、
・最近のゆらぎ方の背景にある構造や巡りの仮説
・どんな波の時期だと受け止めると穏やかか
を伝えることが目的です。

▼ このサービスと3つの機能の概要（ざっくりイメージ）
${legend_v1}

▼ データ構造と整いロジックの詳細
${structure_v1}

----------------
【役割】
- 体質タイプ情報（contexts）・ととのい度チェックの推移（followups）・ケア実施日数（care_logs_daily）を読み取り、
  **「最近の体調や気分のゆらぎ」と「いま崩れやすいポイント」** を短い日本語メッセージとして説明してください。
- 目的は、
  「あ、だから最近こうなってるのかも」とユーザー自身が軽く納得できるように
  “今のからだのストーリー”を言語化してあげることです。
- 具体的な行動指示や、「〜してみてね」といった次のアクションは一切書きません。

【出力フォーマット（重要）】
- 全体で 180〜260 文字程度。
- 必ず 3 つの段落に分け、各段落の間には **空行を1行** 入れること。
- 箇条書きや「・」「1.」などのリスト記号は使わない。

1段落目：あいさつ＋最近の整い方やゆらぎへの一言（1〜2文）
  例）「こんにちは☺️　ここ数日、痛みやこわばりの波が少し落ち着きぎみのタイミングに入っているようです。」

2段落目：体質（type / flowType / organType）とチェック結果・ケア記録を踏まえた「崩れやすいポイント」や「今回のゆらぎ方」の説明（2〜4文）
  - habits / breathing / stretch / tsubo / kampo のどれが効いていそうか、因果の“仮説”として述べてよい。
  - 数値やスコアの具体的な値は出さず、「前よりラクになってきている」「少し負担が戻りやすい」などの言い回しに変換する。
  - 心や気分の波に触れるときも「落ち込みすぎないように支えたい」程度の表現にとどめ、病名や診断めいた表現は避ける。

3段落目：今はどんな波の時期か・どう受け止めるとよさそうかをまとめる一言（1〜2文）
  - ここでも行動の指示（◯◯をやりましょう）は書かない。
  - 「こういう時期なんだな、と少し客観的に眺めておけるとラクかもしれません。」のようなまとめ方にする。

【禁止事項】
- スコア・点数・○点などの数値の直接表現
- 「このケアをやりましょう」「〜してください」などの行動指示
- 医学的な診断名・断定的な治療提案
- 箇条書きやリスト形式での出力
`.trim();

  const user = `
【今日】${date}（${weekdayJp}）

【contexts（体質データそのもの）】
${JSON.stringify(context || null, null, 2)}

【latestFollowup（直近のととのい度チェック）】
${JSON.stringify(latestFollowup || null, null, 2)}

【prevFollowup（1つ前のチェック：あれば比較用）】
${JSON.stringify(prevFollowup || null, null, 2)}

【careCounts（前回チェック〜今回までのケア実施日数）】
${JSON.stringify(careCounts || {}, null, 2)}

※ latestFollowup が null の場合は、
体質（contexts）とケア実施状況だけから「崩れやすいパターン」や最近の波の仮説をまとめてください。
`.trim();

  const rsp = await openai.responses.create({
    model: "gpt-5.1",
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    reasoning: { effort: "low" },
    text: { verbosity: "low" },
  });

  const text = rsp.output_text?.trim();
  return (
    text ||
    `${greeting()} 無理せず、自分のペースで“ととのう数日”を過ごしていきましょうね🌿`
  );
}

async function generateGPTMessage(lineId) {
  try {
    console.log("[reminder] start lineId:", lineId);
    const userId = await getUserIdFromLineId(lineId);
    if (!userId) throw new Error("該当ユーザーが見つかりません");

    // context取得
    const context = await supabaseMemoryManager.getContext(lineId);

    // 最新と1つ前の followup を取得
    const { data: fuRows, error: fuError } = await supabase
      .from("followups")
      .select("symptom_level, sleep, meal, stress, motion_level, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(2);

    if (fuError) {
      console.warn("⚠️ followups取得エラー:", fuError);
    }

    const latestFollowup = fuRows?.[0] || null;
    const prevFollowup = fuRows?.[1] || null;

    // 直近の care_logs（前回〜今回）
    const careCounts =
      await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(
        lineId
      );

    // 日数経過チェック（「チェック空きすぎ」メッセージ判定用）
    const lastDate = latestFollowup?.created_at
      ? new Date(latestFollowup.created_at)
      : context?.created_at
      ? new Date(context.created_at)
      : null;

    const diffDays = lastDate
      ? Math.floor(
          (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

    let msg;
    if (diffDays && diffDays >= 14) {
      // 2週間以上チェックが空いているときの軽い声かけ（ここはシンプルテキスト）
      msg =
        `${greeting()} 少し間が空きましたね🌱 最近の整い、どんな感じですか？\n\n` +
        "ゆっくりでも大丈夫なので、また気が向いたタイミングで「ととのい度チェック」をしてみると、今の波が見えやすくなりますよ😌";
    } else {
      // 通常の「からだの波だより」
      msg = await buildCycleReminder({
        context,
        latestFollowup,
        prevFollowup,
        careCounts,
      });
    }

    return msg;
  } catch (err) {
    console.error("⚠️ generateGPTMessage error:", err);
    return `${greeting()} [fallback] 無理せず、自分のペースで“ととのう数日”を過ごしていきましょうね🌿`;
  }
}

module.exports = { generateGPTMessage };
