const { questionSets } = require('./questionSets');
const { buildQuestionFlex, buildCategorySelectionFlex } = require('../utils/flexBuilder');
const { handleAnswers } = require('./answerRouter'); // ← 回答処理の追加

// セッション管理オブジェクト
const userSessions = {};

async function handleDiagnosis(userId, userMessage) {
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
    if (questionSets[userMessage]) {
      session.selectedCategory = userMessage;
      session.currentStep = 1;
      session.answers = [];

      const questionKey = questionSets[userMessage][`Q1`];
      const flex = await buildQuestionFlex(questionKey);
      return {
        messages: [flex],
      };
    } else {
      return {
        messages: [buildCategorySelectionFlex()],
      };
    }
  }

  // 回答を記録（postback.dataなどの "xxx_Q3_A" → "A" を抽出）
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
    return {
      messages: [flex],
    };
  } else {
    // すべての質問完了 → 診断結果生成
    const result = handleAnswers(session.answers);
    delete userSessions[userId];

    return {
      messages: [
        {
          type: 'text',
          text: `診断結果：「${result.type}」`,
        },
        {
          type: 'text',
          text: `傾向：${result.traits}`,
        },
        {
          type: 'text',
          text: `流れ：${result.flowIssue}`,
        },
        {
          type: 'text',
          text: `臓腑：${result.organBurden}`,
        },
        {
          type: 'text',
          text: `アドバイス：${result.advice}`,
        },
        {
          type: 'text',
          text: result.link,
        },
      ],
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
