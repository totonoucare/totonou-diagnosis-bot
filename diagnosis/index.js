const questionSets = require('./questionSets');
const { buildQuestionFlex, buildCategorySelectionFlex, buildCarouselFlex } = require('../utils/flexBuilder');
const { handleAnswers } = require('./answerRouter');
const { setInitialContext, getInitialContext } = require('../supabaseMemoryManager');

// セッション管理オブジェクト
const userSessions = {};

async function handleDiagnosis(userId, userMessage, rawEvent = null) {
  const session = userSessions[userId];

  if (!session) {
    return {
      messages: [
        {
          type: 'text',
          text: '「診断開始」と送ってから始めてくださいね。'
        }
      ]
    };
  }

  // 主訴が未選択 → 主訴選択フェーズ
  if (!session.selectedCategory) {
    if (typeof userMessage === 'string' && questionSets[userMessage]) {
      session.selectedCategory = userMessage;
      session.currentStep = 1;
      session.answers = [];

      const questionKey = questionSets[userMessage]['Q1'];
      const flex = await buildQuestionFlex(questionKey);
      return {
        messages: [flex],
      };
    } else {
      return {
        messages: [
          {
            type: 'text',
            text: '主訴の選択が正しくありませんでした。もう一度お試しください。',
          },
          buildCategorySelectionFlex(),
        ],
      };
    }
  }

  // 回答を記録
  const choice = userMessage.split('_').pop();
  session.answers.push(choice);
  session.currentStep++;

  const category = session.selectedCategory;
  const questionSet = questionSets[category];

  if (!questionSet) {
    return {
      messages: [
        { type: 'text', text: '該当する質問が見つかりませんでした。' }
      ]
    };
  }

  const nextQuestion = questionSet[`Q${session.currentStep}`];
  if (nextQuestion) {
    const flex = await buildQuestionFlex(nextQuestion);
    const displayText = rawEvent?.postback?.displayText || `あなたの選択：${choice}`;
    return {
      messages: [
        { type: 'text', text: displayText },
        flex,
      ],
    };
  } else {
    // ✅ 全質問完了 → 診断結果生成
    const result = await handleAnswers(session.answers);

    // ✅ 記録保存（再診用）
    setInitialContext(userId, {
      symptom: category,
      motion: session.answers[4],
      typeName: result.type,
      traits: result.traits,
      flowIssue: result.flowIssue,
      organBurden: result.organBurden,
      planAdvice: result.adviceCards,
      link: result.link
    });

    delete userSessions[userId];

    return {
      messages: [
        {
          type: 'text',
          text: `【📝あなたのベース体質】\n\n${result.type}\n\n【🧭体質解説と改善ナビ】\n\n${result.traits}`
        },
        {
          type: 'text',
          text: `【🌀巡りの傾向】\n\n${result.flowIssue}\n\n【🫁内臓への負担傾向】\n\n${result.organBurden}`
        },
        {
          type: 'text',
          text: `【🤖AIが提案！📗あなた専用ととのうガイド】

あなたの体質にぴったりのセルフケア法や整え習慣を  
“ミニガイド📖”にまとめてお届けします🎁

ただいま無料プレゼント中✨  
「ととのうガイド」と入力して、今すぐ受け取ってください♪`
        }
      ]
    };
  }
}

// ✅ 新規追加：キーワード応答用（ととのうガイド）
async function handleExtraCommands(userId, messageText) {
  if (messageText.includes("ととのうガイド")) {
    const context = await getInitialContext(userId);
    if (!context || !context.planAdvice) {
      return {
        messages: [
          { type: 'text', text: '診断データが見つかりませんでした。もう一度診断をお願いします。' }
        ]
      };
    }

    const carousel = buildCarouselFlex(context.planAdvice);
    return {
      messages: [
        carousel,
        {
          type: 'text',
          text: `📅 整えるセルフケア、今週からひとつ試してみませんか？

体質に合わせた“ととのうガイド”をもとに、まずはできそうなことから1つだけで大丈夫。
小さな一歩が、未来のあなたを整えていきます🌱

さらに…

🔒「サブスク登録」すると、
✔ あなた専用の“ととのうAIガイド”が
✔ 習慣化を応援するリマインド機能＋定期のセルフケア状況見直し診断📊をお届け！
（あなたの診断データに基づき、AIが継続をフォローします）

🧭 もし行き詰まりを感じたときは、
オンライン相談や治療院のご案内もございます。
あなたの“整える力”を、ひとりにしません。

「サブスク希望」と入力すると、案内が届きます♪`
        }
      ]
    };
  }

  return null;
}

function startSession(userId) {
  userSessions[userId] = {
    currentStep: 0,
    selectedCategory: null,
    answers: [],
  };
}

function hasSession(userId) {
  return !!userSessions[userId];
}

module.exports = {
  handleDiagnosis,
  startSession,
  hasSession,
  handleExtraCommands
};
