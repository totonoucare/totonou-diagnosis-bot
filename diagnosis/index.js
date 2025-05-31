// diagnosis/index.js

const { questionSets } = require('./questionSets');
const { buildQuestionFlex, buildCategorySelectionFlex } = require('../utils/flexBuilder');

// 簡易セッション管理（今回はin-memory。実運用ではDBかRedis推奨）
const userSessions = {};

// 診断フロー本体
function handleDiagnosis(userId, userMessage) {
  const session = userSessions[userId];

  // 主訴が未選択 → 主訴選択メッセージ表示
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

  // 回答を記録
  session.answers.push(userMessage);
  session.currentStep += 1;

  const category = session.selectedCategory;
  const questionSet = questionSets[category];

  if (session.currentStep <= questionSet.length) {
    const nextQuestion = questionSet[session.currentStep - 1];
    return {
      messages: [buildQuestionFlex(nextQuestion)],
    };
  } else {
    // すべての質問が完了 → 結果出力
    const result = session.answers.join(' - ');
    delete userSessions[userId]; // セッション終了

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

// 診断開始時のみセッションを新規作成
function startSession(userId) {
  userSessions[userId] = {
    currentStep: 1,
    selectedCategory: null,
    answers: [],
  };
}

// セッションの有無をチェック
function hasSession(userId) {
  return !!userSessions[userId];
}

module.exports = {
  handleDiagnosis,
  startSession,
  hasSession
};
