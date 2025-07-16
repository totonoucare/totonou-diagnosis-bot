const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const { getUserIdFromLineId } = require("./getUserIdFromLineId");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildReminderPrompt(latestFollowup, advice = {}) {
  const {
    habits = "", breathing = "", stretch = "", tsubo = "", kampo = ""
  } = advice;

  return `
以下は、あるユーザーの最近の定期チェックナビの回答内容です。
初回の体質ケア分析では体質に応じた「ととのうケアガイド」（5つのセルフケア）を提案しており、その進捗状況をもとにリマインドコメントを作成してください。

【followups テーブルのカラム定義】
- symptom_level：1＝改善／5＝全く改善なし
- general_level：1＝改善／5＝全く改善なし
- sleep：1＝とても良い／5＝かなり悪い
- meal：1＝とても良い／5＝かなり悪い
- stress：1＝とても良い／5＝かなり悪い
- habits：未着手 < 時々 < 継続中
- breathing：未着手 < 時々 < 継続中
- stretch：未着手 < 時々 < 継続中
- tsubo：未着手 < 時々 < 継続中
- kampo：未着手 < 時々 < 継続中
- q5_answer：セルフケアで一番困ったことを選択  
　A: やり方が分からなかった  
　B: 効果を感じなかった  
　C: 時間が取れなかった  
　D: 体に合わない気がした  
　E: モチベーションが続かなかった  
　F: 特になし

【このユーザーの最新の定期チェックナビのデータ】
- symptom_level：${latestFollowup.symptom_level}
- general_level：${latestFollowup.general_level}
- sleep：${latestFollowup.sleep}
- meal：${latestFollowup.meal}
- stress：${latestFollowup.stress}
- habits：${latestFollowup.habits}
- breathing：${latestFollowup.breathing}
- stretch：${latestFollowup.stretch}
- tsubo：${latestFollowup.tsubo}
- kampo：${latestFollowup.kampo}
- q5_answer：${latestFollowup.q5_answer}

【初回の体質ケア分析に基づくセルフケアアドバイス（ととのうケアガイド）】
1. 💡体質改善習慣: ${habits}
2. 🧘呼吸法: ${breathing}
3. 🤸ストレッチ: ${stretch}
4. 🎯ツボケア: ${tsubo}
5. 🌿漢方薬: ${kampo}

【指示】
・上記の情報をもとに、「このうち1つをピックアップ」して、実施状況に合わせた優しいリマインドメッセージを作成してください。
・もし q5_answer に困りごとがある場合は、その悩みに寄り添うトーンで書いてください。
・文量は100〜200文字程度。
・明るく親しみやすい口調で、絵文字を1〜2個含めてください。
・定期チェックナビを受けていない場合は、ととのうケアガイドだけを参考にしてください。
`;
}

async function generateGPTMessage(lineId) {
  try {
    // ✅ Supabase上の uuid を取得（followups用）
    const userId = await getUserIdFromLineId(lineId);
    if (!userId) throw new Error("該当ユーザーが見つかりません");

    // 最新の followup データ取得
    const { data: followups, error: followupError } = await supabase
      .from("followups")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const followup = followups?.[0];

    // ✅ getContext に lineId をそのまま渡す（中で line_id で検索する）
    const context = await supabaseMemoryManager.getContext(lineId);
    const advice = context?.advice || {};

    if (!followup) {
      return `こんにちは！最近の診断はまだ未実施のようですね😊\n\n以前お伝えしたセルフケアの中から、まずは「呼吸法」だけでも、今日少し意識してみませんか？\n${advice.breathing || "深く吐くことから始めてみましょう🌿"}`;
    }

    const prompt = buildReminderPrompt(followup, advice);

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
