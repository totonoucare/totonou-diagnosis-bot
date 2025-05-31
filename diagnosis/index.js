const questionSets = require('./questionSets');
const { buildQuestionFlex, buildCategorySelectionFlex } = require('../utils/flexBuilder');

// セッション管理
const userSessions = {};

function handleDiagnosis(userId, userMessage) {
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

  // 主訴が未選択 → ここで選択処理をする
  if (!session.selectedCategory) {
    if (questionSets[userMessage]) {
      session.selectedCategory = userMessage;
      session.currentStep = 1;
      session.answers = [];

      const questionKey = questionSets[userMessage][`Q${session.currentStep}`];
      return {
        messages: [buildQuestionFlex(questionKey)],
      };
    } else {
      return {
        messages: [buildCategorySelectionFlex()],
      };
    }
  }

  // 回答を記録
  session.answers.push(userMessage);
  session.currentStep += 1;

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
    return {
      messages: [buildQuestionFlex(nextQuestion)],
    };
  } else {
    const result = session.answers.join(' - ');
    delete userSessions[userId];

    return {
      messages: [
        {
          type: 'text',
          text: `診断完了です！あなたの回答：${result}`
        }
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
