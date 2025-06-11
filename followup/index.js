// followup/index.js

const questionSets = require('./questionSets');
const handleFollowupAnswers = require('./followupRouter');
const memoryManager = require('./memoryManager');
const sendGPTResponse = require('./responseSender');

// ユーザーの進行状態を記録
const userSession = {}; // userSession[userId] = { step: 1, answers: [] }

async function handleFollowup(event, client, userId) {
  try {
    const message = event.message.text.trim();

    // 診断開始トリガー（手動で変更してOK）
    if (message === 'ととのう計画') {
      userSession[userId] = { step: 1, answers: [] };

      const q1 = questionSets[0]; // Q1を出す
      return [buildFlexMessage(q1)];
    }

    // セッションがない or 無効
    if (!userSession[userId]) {
      return [{
        type: 'text',
        text: '診断を始めるには「ととのう計画」と送ってください。'
      }];
    }

    const session = userSession[userId];

    // 現在の質問インデックス
    const currentStep = session.step;
    const question = questionSets[currentStep - 1];

    // 入力された答え（A〜E）だけを抽出
    const answer = message.trim().charAt(0).toUpperCase();
    const isValid = question.options.some(opt => opt.startsWith(answer));

    if (!isValid) {
      return [{
        type: 'text',
        text: 'A〜Eの中から選んでください。'
      }];
    }

    // 回答を記録
    if (question.id === 'Q3') {
      // Q3のみ複数選択対応なら拡張（今回は単純に1回答のみ）
      session.answers.push({
        habits: answer,
        stretch: answer,
        breathing: answer,
        kampo: answer,
        other: answer
      });
    } else {
      session.answers.push(answer);
    }

    session.step++;

    // すべての質問が終わったら診断へ
    if (session.step > questionSets.length) {
      const answers = session.answers;
      const memory = memoryManager.getUserData(userId) || {};
      const context = {
        symptom: memory.symptom || '体の不調',
        motion: memory.motion || '特定の動作',
      };

      const result = await handleFollowupAnswers(userId, answers);
      const gptReply = await sendGPTResponse(result.promptForGPT);

      delete userSession[userId]; // セッション破棄

      return [{
        type: 'text',
        text: '📋【今回の再診結果】\n' + gptReply
      }];
    }

    // 次の質問を返す
    const nextQuestion = questionSets[session.step - 1];
    return [buildFlexMessage(nextQuestion)];

  } catch (err) {
    console.error('❌ followup/index.js エラー:', err);
    return [{
      type: 'text',
      text: '診断中にエラーが発生しました。もう一度「ととのう計画」と送って再開してください。'
    }];
  }
}

// Flexメッセージを組み立てる関数（選択肢A〜E）
function buildFlexMessage(question) {
  return {
    type: 'flex',
    altText: question.header,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: question.header,
          weight: 'bold',
          size: 'md',
          color: '#ffffff',
        }],
        backgroundColor: '#788972',
        paddingAll: '12px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: question.body,
            wrap: true,
            color: '#333333',
            size: 'md',
          },
          {
            type: 'separator',
            margin: 'md',
          },
          ...question.options.map(option => {
            const label = option;
            const data = option.charAt(0); // A〜Eのみ送信
            return {
              type: 'button',
              action: {
                type: 'postback',
                label,
                data,
                displayText: label,
              },
              style: 'primary',
              height: 'sm',
              margin: 'sm',
              color: '#828E7B',
            };
          })
        ],
      },
    },
  };
}

module.exports = handleFollowup;
