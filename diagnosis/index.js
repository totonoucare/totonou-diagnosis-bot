const questionSets = require('./questionSets');
const { buildQuestionFlex, buildCategorySelectionFlex } = require('../utils/flexBuilder');
const { handleAnswers } = require('./answerRouter');

// セッション管理オブジェクト
const userSessions = {};

async function handleDiagnosis(userId, userMessage, rawEvent = null) {
  const session = userSessions[userId];

  // セッションがない場合
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

  // 回答を記録（postback.data から "xxx_Q3_A" → "A" を抽出）
  const choice = userMessage.split('_').pop();
  session.answers.push(choice);
  session.currentStep++;

  const category = session.selectedCategory;
  const questionSet = questionSets[category];

  if (!questionSet) {
    return {
      messages: [
        {
          type: 'text',
          text: '該当する質問が見つかりませんでした。'
        }
      ]
    };
  }

  const nextQuestion = questionSet[`Q${session.currentStep}`];
  if (nextQuestion) {
    const flex = await buildQuestionFlex(nextQuestion);

    // displayTextがある場合はそれを表示（なければchoiceのA〜Eを出す）
    const displayText = rawEvent?.postback?.displayText || `あなたの選択：${choice}`;

    return {
      messages: [
        { type: 'text', text: displayText },
        flex,
      ],
    };
  } else {
    // すべての質問完了 → 診断結果生成
    const result = handleAnswers(session.answers);
    delete userSessions[userId];

    return {
      messages: [
        { type: 'text', text: `【診断結果】\n${result.type}` },
        { type: 'text', text: `【🔍お体の傾向】\n${result.traits}\n\n【🌀巡りの傾向】\n${result.flowIssue}` },
        { type: 'text', text: `【🫁内臓の乱れと簡単セルフケア】\n${result.organBurden}` },
        { type: 'text', text: `【💡ととのう習慣アドバイス】\n${result.advice}` },
        { type: 'text', text: `【🌿おすすめ漢方薬（市販）】\n${result.link}` },
      ]
    };
  }
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
};
