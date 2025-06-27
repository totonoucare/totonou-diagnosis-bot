const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildReminderPrompt(parts = {}) {
  const { habits, breathing, stretch, tsubo, kampo } = parts;

  return `
以下は、あるユーザーの最近の定期チェック診断の回答内容です。
初回診断では体質に応じた「ととのうガイド」（5つのセルフケア）を提案しており、その進捗状況をもとにリマインドコメントを作成してください。

【診断データ】
- 体質改善習慣（habits）: ${habits}
- 呼吸法（breathing）: ${breathing}
- ストレッチ（stretch）: ${stretch}
- ツボケア（tsubo）: ${tsubo}
- 漢方薬（kampo）: ${kampo}

【指示】
・前回診断の結果に軽く触れながら、「このうち1つをピックアップ」して、実施状況についての問いかけや優しく寄り添う一言メッセージを送ってください。
・文量は100〜200文字程度。
・明るく親しみやすいトーンで、絵文字を1〜2個含めてください。
・診断を受けていない場合は、初回診断のガイド内容の中から、1つをピックアップしてコメントしてください。
`;
}

async function generateGPTMessage(userId) {
  try {
    // userIdに紐づく最新の診断データを取得（followupsのcreated_at降順）
    const { data: followups, error } = await supabase
      .from("followups")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const followup = followups?.[0];

    if (!followup) {
      // 診断データなし → 通常のセルフケアメッセージ（初回ガイド準拠）
      return "こんにちは！最近の診断はまだ未実施のようですね😊\n\n以前お伝えしたセルフケアの中から、まずは「呼吸法」だけでも、今日少し意識してみませんか？\n深く吐くことからはじめてみましょう🌿";
    }

    // プロンプト構築
    const prompt = buildReminderPrompt(followup);

    // GPT呼び出し
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは東洋医学に詳しい親しみやすいキャラのAIで、セルフケアの習慣化を優しく支援する伴走者です。診断履歴を参考にして、問いかけ型や励ましの言葉で寄り添ってください。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.85,
      max_tokens: 500,
    });

    const gptComment = completion.choices?.[0]?.message?.content?.trim();

    return gptComment || "今日も無理せず、自分のペースで“ととのう”を続けていきましょうね🌱";
  } catch (error) {
    console.error("⚠️ GPTメッセージ生成エラー:", error);
    return "リマインドメッセージの生成に失敗しました。次回の診断で状況をお聞かせください😊";
  }
}

module.exports = {
  generateGPTMessage,
};
