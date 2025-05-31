// diagnosis/index.js

const { questionSets } = require('./questionSets');
const { buildQuestionFlex, buildCategorySelectionFlex } = require('../utils/flexBuilder');

// 簡易セッション管理（今回はin-memory。実運用ではDBかRedis推奨）
const userSessions = {};

function handleDiagnosis(userId, userMessage) {
  const msg = userMessage.toLowerCase();
  const isStartTrigger = ['診断開始'].some(keyword =>
    msg.includes(keyword)
  );

  // セッションが存在しない場合の初期化処理
  if (!userSessions[userId]) {
    if (isStartTrigger) {
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
    } else {
      return {
        messages: [
          {
            type: 'text',
            text: '診断を始めるには「診断」や「スタート」などと送ってくださいね！'
          }
        ]
      };
    }
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
    // すべての質問が完了 → 結果処理へ（仮の出力）
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
