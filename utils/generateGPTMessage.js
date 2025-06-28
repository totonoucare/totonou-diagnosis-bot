const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const { getUserIdFromLineId } = require("./getUserIdFromLineId");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildReminderPrompt(latestFollowup, advice = {}) {
  const { habits = "", breathing = "", stretch = "", tsubo = "", kampo = "" } = advice;

  return `
以下は、あるユーザーの最近の定期チェック診断の回答内容です。
初回診断では体質に応じた「ととのうガイド」（5つのセルフケア）を提案しており、その進捗状況（定期チェック診断）をもとにリマインドコメントを作成してください。

【診断データ（定期チェック診断）】
- 体質改善習慣（habits）: ${latestFollowup.habits}
- 呼吸法（breathing）: ${latestFollowup.breathing}
- ストレッチ（stretch）: ${latestFollowup.stretch}
- ツボケア（tsubo）: ${latestFollowup.tsubo}
- 漢方薬（kampo）: ${latestFollowup.kampo}

【初回診断に基づくセルフケアアドバイス（Myととのうガイド）】
1. 💡体質改善習慣: ${habits}
2. 🧘呼吸法: ${breathing}
3. 🤸ストレッチ: ${stretch}
4. 🎯ツボケア: ${tsubo}
5. 🌿漢方薬: ${kampo}

【指示】
・上記内容をもとに、「このうち1つをピックアップ」して、実施状況についての問いかけや優しく寄り添う一言メッセージを作成してください。
・文量は100〜200文字程度。
・明るく親しみやすいトーンで、絵文字を1〜2個含めてください。
・診断を受けていない場合は、初回診断のガイド内容の中から、1つをピックアップしてコメントしてください。
`;
}

async function generateGPTMessage(lineId) {
  try {
    // LINE ID → Supabaseのuser_idに変換
    const userId = await getUserIdFromLineId(lineId);
    if (!userId) throw new Error("該当ユーザーが見つかりません");

    // 定期チェック診断データ取得
    const { data: followups, error: followupError } = await supabase
      .from("followups")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const followup = followups?.[0];

    // 初回診断コンテキスト取得（Myととのうガイド含む）
    const context = await supabaseMemoryManager.getContext(userId);
    const advice = context?.advice || {};

    // フォローアップ診断がない場合（初回ガイドベースで簡易メッセージ）
    if (!followup) {
      return `こんにちは！最近の診断はまだ未実施のようですね😊\n\n以前お伝えしたセルフケアの中から、まずは「呼吸法」だけでも、今日少し意識してみませんか？\n${advice.breathing || "深く吐くことから始めてみましょう🌿"}`;
    }

    // プロンプト生成
    const prompt = buildReminderPrompt(followup, advice);

    // OpenAI 呼び出し
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
