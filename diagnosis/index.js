const { questionSets } = require('./questionSets');
const { buildQuestionFlex, buildCategorySelectionFlex } = require('../utils/flexBuilder');

// 簡易セッション管理
const userSessions = {};

// 診断フロー本体
function handleDiagnosis(userId, userMessage) {
  const session = userSessions[userId];

  // ✅ セッション自体がなければ何もしない
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

  // ✅ 主訴が未選択 → 主訴選択を促す
  if (!session.selectedCategory) {
    return {
      messages: [buildCategorySelectionFlex()],
      sessionUpdate: (userMessage) => {
        session.selectedCategory = userMessage;
        session.currentStep = 1;
        session.answers = [];
      }
    };
  }

  // 回答記録
  session.answers.push(userMessage);
  session.currentStep += 1;

  const category = session.selectedCategory;
  const questionSet = questionSets[category];

  // ✅ 質問セットが存在するかチェック
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

  if (session.currentStep <= questionSet.length) {
    const nextQuestion = questionSet[`Q${session.currentStep}`];
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
