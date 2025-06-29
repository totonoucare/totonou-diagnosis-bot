const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🧭 初回診断時motionの経絡対応
function getMeridianFromMotion(motion) {
  switch (motion) {
    case "前屈":
    case "立って前屈する":
      return "腎経／膀胱経（体背面ライン）";
    case "上体をそらす":
    case "上体をそらす（腰に手を当て）":
      return "脾経／胃経（前面ライン）";
    case "バンザイ":
    case "腕をバンザイする":
      return "心経／小腸経（腕の内側ライン）";
    case "腰を左右にねじる":
    case "腰を側屈":
      return "肝経／胆経（体側ライン）";
    case "首を後ろに倒す":
    case "首を左右に回す":
      return "肺経／大腸経（首前面ライン）";
    default:
      return "不明";
  }
}

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

【回答スケール定義】
- Q1/Q2/Q4：1＝とても良い（改善）／5＝悪化・不調
- Q3（セルフケア習慣）：未着手 < 時々 < 継続中
- Q5：セルフケアで一番困ったことを選択（A:やり方が分からなかった／B:効果を感じなかった／C:時間が取れなかった／D:体に合わない気がした／E:モチベーションが続かなかった／F:特になし）

	1.	初回診断時に提示した「ととのうガイド」という5つのセルフケア項目について、Q3の質問項目で実践度合いを尋ねています。取り組めた点を1つだけ選び、しっかり褒めて応援してください（絵文字も入れて）。
	2.	Q3で実行度合いが低かったセルフケア項目に注目し、その中でも優先度が高いセルフケア項目を1〜2つ選び、改善提案とヒントを添えてください。
優先度は以下の通りです。
・1位：体質改善習慣　・2位：ストレッチ  ・3位：呼吸法　・4位：ツボ　・5位：漢方薬
        3.	コメントは350文字前後で端的に。あたたかく、信頼できる語り口でお願いします。また、可読性を高めるための工夫（段落分け（1行空け）や箇条書き、絵文字など）も使いこなしてください。
	4.	Q4の「動作テストの変化」は、初回診断時の動作テストの結果（motion）で判明した、最も伸展しづらく負荷が大きかった経絡ライン＝臓腑不調のサインの改善度合い（「5」＝最もツラい、「1」＝改善）を再確認するための設問です。
この動作は、そのまま経絡ストレッチ（Q3のストレッチ項目）としてユーザーに指導アドバイスしており、その改善度合い（Q4の回答）は該当経絡や臓腑の状態変化を示す重要な指標です。
よって、Q4での「動作テストの変化」の結果が改善傾向（度合いが１〜2）でなければ、Q3ストレッチ項目との関連性を意識したアドバイスをしてください。不調のある筋膜ラインの柔軟性改善で体全体の構造バランスや影響する臓腑の調子が整うと伝えています。
以下は、初回診断時の動作テスト結果（motion）と、それに対応する経絡（筋膜ライン）とのマッピングです。
	•	首を後ろに倒す／左右に回す → 肺経／大腸経（首前面ラインの伸展）
	•	腕をバンザイする → 心経／小腸経（腕の内側ラインの伸展）
	•	立って前屈する → 腎経／膀胱経（体背面ラインの伸展）
	•	腰を左右にねじるor側屈 → 肝経／胆経（体側ラインの伸展）
	•	上体をそらす（腰に手を当て） → 脾経／胃経（腹部・太もも前面ラインの伸展）
	5.	 必要に応じて、初回診断時の体質スコア・体質タイプ・巡りの傾向・臓腑の負担傾向なども参考にしてコメントに織り交ぜてください（簡潔でOKです）。
 ただし、原則として提案するセルフケア内容は「ととのうガイド」の提案内容に準拠すること（ツボやストレッチなどを勝手に他の指導に変更しないこと）。
        6.	Q2の「生活リズムの整い具合」が乱れぎみ（４〜5）の場合、セルフケア以前にここを見さないと不調の原因の一つになるという柔らかい提言と前向きな工夫を一言アドバイスしてください。
	7.	Q5（セルフケアで困ったこと）の回答内容にも必ず触れてください。その困りごとがある状態でもできる工夫や、気持ちの面で寄り添うコメントを入れてください。
	8.	コメントの冒頭に、以下の条件に応じた評価コメントを必ず1つだけ選んで表示してください。スコアは数値で渡されます（symptom_level と general_level は1〜5の整数です）。
 - 【改善A】主訴の変化(symptom_level)が1または2、かつ全体の体調(general_level)も1または2の場合：
　🎉 お悩みの症状も全体の体調も改善していますね！今後は定期チェック診断機能のみ（月額半額）での継続もご検討いただけます。

- 【改善B】主訴(symptom_level)が1または2、かつ全体の体調(general_level)が3〜5の場合：
　🎯 お悩みの症状は落ち着きましたが、全体的な体調がまだ不安定なようですね。お体のバランス再評価ため、もう一度初回診断を受けてみることをおすすめします🌱

- 【その他】上記以外（まだ改善途中）の場合：
　📊 改善の途中段階ですが、続けていくと着実にお身体は変化していきます！引き続きサポートいたしますので、安心して一緒にととのえていきましょう！

※いずれか1つだけ選び、コメント冒頭に自然な文脈で織り交ぜてください。


【初回診断の結果】
- 主訴：${parts.symptom || "未登録"}
- 体質タイプ：${parts.typeName || "不明"}
- 傾向：${parts.traits || "不明"}
- 巡りの傾向：${parts.flowIssue || "不明"}
- 内臓の負担傾向：${parts.organBurden || "不明"}
- 初回診断時の動作テスト：${parts.motion || "未登録"}（${getMeridianFromMotion(parts.motion)}）

${scoreExplanation}

【ととのうガイド】
1. 💡体質改善習慣\n${find("体質改善")}
2. 🧘巡り呼吸\n${find("呼吸")}
3. 🤸経絡ストレッチ\n${find("ストレッチ")}
4. 🎯ツボケア\n${find("ツボ")}
5. 🌿漢方薬\n${find("漢方")}

【再診データ】
- 主訴の変化(Q1)：${parts.symptom_level || "未入力"}
- 全体の体調(Q1)：${parts.general_level || "未入力"}
- 生活リズムの整い具合(Q2)：
  ・睡眠：${parts.sleep || "未入力"}
  ・食事：${parts.meal || "未入力"}
  ・ストレス：${parts.stress || "未入力"}
- セルフケア実施状況(Q3)：
  ・習慣：${parts.habits || "未入力"}
  ・呼吸法：${parts.breathing || "未入力"}
  ・ストレッチ：${parts.stretch || "未入力"}
  ・ツボ：${parts.tsubo || "未入力"}
  ・漢方：${parts.kampo || "未入力"}
- 動作テストの変化(Q4)：${parts.motion_level || "未入力"}
- セルフケアで困ったこと（Q5）：${parts.q5_answer || "未入力"}
`;
}

async function sendFollowupResponse(userId, followupAnswers) {
  try {
    const context = await supabaseMemoryManager.getContext(userId);
    
    // 🔄 Q1〜Q5などの回答を優先してマージ
    const promptParts = {
      ...followupAnswers,
      ...context,
    };

    const prompt = buildPrompt(promptParts);

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "あなたは東洋医学に詳しいセルフケア伴走AIです。親しみやすく可愛げのあるキャラで、希望が持てるアドバイスを350文字前後で返してください。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.85,
      max_tokens: 1200,
    });

    const gptComment = chatCompletion.choices?.[0]?.message?.content || "解析に失敗しました。";

    return {
      gptComment,
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
