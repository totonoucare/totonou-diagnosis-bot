// diagnosis/index.js

const { questionSets } = require('./questionSets');
const { buildQuestionFlex, buildCategorySelectionFlex } = require('../flex/templates');

// 簡易セッション管理（今回はin-memory。実運用ではDBかRedis推奨）
const userSessions = {};

function handleDiagnosis(userId, userMessage) {
  // ユーザーのセッションがなければ初期化
  if (!userSessions[userId]) {
    return {
      messages: [buildCategorySelectionFlex()],
      sessionUpdate: (userMessage) => {
        userSessions[userId] = {
          currentStep: 1,
          selectedCategory: userMessage,
          answers: [],
        };
      }
    };
  }

  const session = userSessions[userId];

  // 主訴が未選択 → 主訴名とセッション初期化
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
    // すべての質問が完了 → 結果処理へ（仮：そのまま表示）
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

module.exports = { handleDiagnosis };
