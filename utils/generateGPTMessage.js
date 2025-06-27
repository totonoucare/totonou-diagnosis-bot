const { supabase } = require('../supabaseClient');
const OpenAI = require('openai');

// OpenAIインスタンスの初期化（環境変数から取得）
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * LINE IDから直近のフォローアップ診断結果を取得する
 */
async function getLatestFollowup(lineId) {
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('line_id', lineId)
    .single();

  if (userError || !userData) {
    console.error('❌ ユーザー取得失敗', userError);
    return null;
  }

  const { data: followup, error: followupError } = await supabase
    .from('followups')
    .select('*')
    .eq('user_id', userData.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (followupError || !followup) {
    console.error('❌ フォローアップ診断の取得失敗', followupError);
    return null;
  }

  return followup;
}

/**
 * フォローアップ診断結果に応じたGPTメッセージを生成
 */
async function generateGPTMessage(lineId) {
  const followup = await getLatestFollowup(lineId);

  if (!followup) {
    return 'こんにちは！最近の診断データが見つからなかったため、今回は一般的なセルフケアをおすすめします。気になることがあれば、いつでもご相談ください😊';
  }

  // フォローアップ診断の情報を要約してプロンプトに含める
  const prompt = `
あなたは東洋医学の専門アシスタントです。
以下はあるユーザーの直近の定期チェック診断結果です。
この診断内容をもとに、改善傾向・維持すべきこと・少し注意が必要な点などを踏まえて、
「一言アドバイス＋応援メッセージ（合計200文字程度）」を日本語で優しく提案してください。

--- ユーザー診断データ ---
${JSON.stringify(followup, null, 2)}
---------------------------

# 出力フォーマット（改行含めず一文で）：
例：「この1週間、調子は少しずつ整ってきていますね！引き続き“中脘ケア”を意識して、焦らずじっくり進めていきましょう✨」
`;

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'あなたは東洋医学の専門アシスタントです。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 300,
    });

    return chat.choices[0].message.content.trim();
  } catch (err) {
    console.error('❌ GPTメッセージ生成エラー', err);
    return 'こんにちは！最近の様子はいかがですか？焦らず、できるところから整えていきましょうね😊';
  }
}

module.exports = {
  generateGPTMessage,
};
