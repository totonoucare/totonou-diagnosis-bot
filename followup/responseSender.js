const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildPrompt(parts = {}) {
  const { scores = [], adviceCards = [] } = parts;
  const [score1, score2, score3] = scores;

  const scoreExplanation = scores.length === 3
    ? `
【初回診断時の体質スコア】
- 虚実（体力の絶対量）: ${score1}
- 寒熱（体内の熱状態）: ${score2}
- 気血バランス: ${score3}（+1=気虚／-1=血虚）

※ スコア定義
- 虚実： -1 = 虚（体力少ない）／+1 = 実（体力あり）
- 寒熱： -1 = 寒（冷え体質）／+1 = 熱（熱がこもる体質）
- 陰陽： -1 = 血虚（栄養・潤い不足）／+1 = 気虚（エネルギー不足）
`
    : "（体質スコアの記録はありません）";

  const find = (keyword) =>
    adviceCards.find(c => c.header?.includes(keyword))?.body || "（アドバイス未登録）";

  return `
以下の情報をもとに、定期チェックユーザーに対してやさしく寄り添うようにアドバイスしてください。

	1.	初回診断時に提示した「ととのうガイド」という5つのセルフケア項目（Q3の質問項目に該当）に沿って取り組めた点を1つだけ選び、しっかり褒めて応援してください（絵文字も入れて）。
	2.	Q3で実行度合いが低かったセルフケア項目に注目し、その中でも優先度が高いセルフケア項目を2つ選び、改善提案とヒントを添えてください。
優先度は以下の通りです。
・1位：体質改善習慣　・2位：ストレッチ  ・3位：呼吸法　・4位：ツボ　・5位：漢方薬
	3.	コメントは350文字前後で端的に。あたたかく、信頼できる語り口でお願いします。また、可読性を高めるための工夫（段落分け（1行空け）や箇条書き、絵文字など）も使いこなしてください。
	4.	Q4の「動作テストの変化」は、初回診断で判明した、最も伸展しづらく負荷が大きかった経絡ライン（＝臓腑不調のサイン）の改善度合いを尋ねる設問です。
この動作は、そのまま**対応する経絡ストレッチ（Q3のストレッチ項目）にもなっており、**その改善度は該当経絡の状態変化を示す重要な指標です。
よって、Q4の結果をもとに、Q3ストレッチ項目との関連性を意識したアドバイスや声掛けを行ってください。
以下は、Q4で再確認している動作「{{motion}}」と、それに対応する経絡（筋膜ライン）・臓腑とのマッピングです。

※「{{motion}}」は、ユーザーが初回診断で選択した動作名（例：前屈、バンザイ動作など）として文字列で与えられます。
	•	首を後ろに倒す／左右に回す → 肺経／大腸経（首前面ラインの伸展）
	•	腕をバンザイする → 心経／小腸経（腕の内側ラインの伸展）
	•	立って前屈する → 腎経／膀胱経（体背面ラインの伸展）
	•	腰を左右にねじるor側屈 → 肝経／胆経（体側ラインの伸展）
	•	上体をそらす（腰に手を当て） → 脾経／胃経（腹部・太もも前面ラインの伸展）

	5.	必要に応じて、初回診断時の体質スコア・タイプ・臓腑の傾向・巡りの傾向なども参考にしてコメントに織り交ぜてください（簡潔でOKです）。
	6.	Q5（セルフケアで困ったこと）の回答内容にも必ず触れてください。その困りごとがある状態でもできる工夫や、気持ちの面で寄り添うコメントを入れてください。
※Q5で「その他の理由」が選ばれた場合は、具体的な内容が分からないことを踏まえて、「どんな理由があっても大丈夫」というスタンスで寄り添うコメントにしてください。
	7.	コメントの冒頭に、主訴（Q1）と全体体調（Q2）のスコアに基づいた以下の評価コメントのうち該当するものを1つだけ表示してください。その後の文章に自然につながるように、自然な文調にしてもらっても大丈夫です。：

【主訴が改善（1〜2）かつ全体も改善（1〜2）】
🎉 お悩みの症状も全体の体調も改善していますね！今後はリマインド機能のみ（月額半額）の継続もご検討いただけます。

【主訴が改善（1〜2）だが全体は不調（3〜5）】
🎯 お悩みの症状は落ち着きましたが、全体的な体調がまだ不安定なようですね。再評価のため、もう一度初回診断を受けてみることをおすすめします🌱

【それ以外（まだ改善途中）】
📊 改善の途中段階ですが、続けていくと着実にお身体は変化していきます！引き続きサポートいたしますので、安心して一緒にととのえていきましょう！


【スケール定義】
- Q1/Q2/Q4：1＝とても良い（改善）／5＝悪化・不調
- Q3（セルフケア習慣）：未実施 < 時々 < ほぼ毎日
- Q5：セルフケアで一番困ったことを選択（A:やり方が分からなかった／B:効果を感じなかった／C:時間が取れなかった／D:体に合わない気がした／E:モチベが続かなかった／F:その他）

【初回診断の結果】
- 体質タイプ：${parts.typeName || "不明"}
- 傾向：${parts.traits || "不明"}
- 巡りの傾向：${parts.flowIssue || "不明"}
- 内臓の負担傾向：${parts.organBurden || "不明"}

${scoreExplanation}

【ととのうガイド】
1. 💡体質改善習慣\n${find("体質改善")}
2. 🧘巡り呼吸\n${find("呼吸")}
3. 🤸経絡ストレッチ\n${find("ストレッチ")}
4. 🎯ツボケア\n${find("ツボ")}
5. 🌿漢方薬\n${find("漢方")}

【再診データ】
- 主訴：${parts.symptom || "未登録"}
- 主訴の変化：${parts.symptom_level || "未入力"}
- 全体の体調：${parts.general_level || "未入力"}
- 動作テストの変化：${parts.motion_level || "未入力"}

- セルフケア実践：
  ・睡眠：${parts.sleep || "未入力"}
  ・食事：${parts.meal || "未入力"}
  ・ストレス：${parts.stress || "未入力"}
  ・習慣：${parts.habits || "未入力"}
  ・呼吸法：${parts.breathing || "未入力"}
  ・ストレッチ：${parts.stretch || "未入力"}
  ・ツボ：${parts.tsubo || "未入力"}
  ・漢方：${parts.kampo || "未入力"}

- セルフケアで困ったこと（Q5）：${parts.q5_answer || "未入力"}
`;
}

async function sendFollowupResponse(userId, followupAnswers) {
  try {
    const context = await supabaseMemoryManager.getContext(userId);
    const promptParts = {
      ...context,
      ...followupAnswers,
    };

    const prompt = buildPrompt(promptParts);

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "あなたは東洋医学に詳しいセルフケア支援AIです。親しみやすく、希望が持てるアドバイスを350文字前後で返してください。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.85,
      max_tokens: 1200,
    });

    const gptComment = chatCompletion.choices?.[0]?.message?.content || "解析に失敗しました。";

    const sym = parseInt(followupAnswers.symptom_level);
    const gen = parseInt(followupAnswers.general_level);

    let statusMessage = "";

    if (sym <= 2 && gen <= 2) {
      statusMessage = `🎉 お悩みの症状も全体の体調も改善していますね！\n今後はリマインド機能のみ（月額半額）の継続もご検討いただけます。`;
    } else if (sym <= 2 && gen >= 3) {
      statusMessage = `🎯 お悩みの症状は落ち着きましたが、全体的な体調がまだ不安定なようですね。\n再評価のため、もう一度初回診断を受けてみることをおすすめします🌱`;
    } else {
      statusMessage = `📊 改善の途中段階ですが、続けていくと着実にお身体は変化していきます！引き続きサポートいたしますので、安心して一緒にととのえていきましょう！`;
    }

    return {
      gptComment,
      statusMessage,
    };
  } catch (err) {
    console.error("❌ フォローアップ解析エラー:", err);
    return {
      gptComment: "再診コメントの生成に失敗しました。",
      statusMessage: "エラーが発生しました。しばらくしてからお試しください。",
    };
  }
}

module.exports = {
  sendFollowupResponse,
};
