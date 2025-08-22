const questionSets = require('./questionSets');
const typeImageDictionary = require('./typeImageDictionary');
const typeCodeDictionary = require('./typeCodeDictionary');
const flowCodeDictionary = require('./flowCodeDictionary');
const organCodeDictionary = require('./organCodeDictionary');

const {
  buildQuestionFlex,
  buildCategorySelectionFlex,
  buildCarouselFlex,
  buildTrialStartFlex,
  buildResultFlex
} = require('../utils/flexBuilder');
const { handleAnswers } = require('./answerRouter');
const {
  saveContext,
  getContext,
  initializeUser,
  markGuideReceived
} = require('../supabaseMemoryManager');

const userSessions = {};

async function handleDiagnosis(userId, userMessage, rawEvent = null) {
  const session = userSessions[userId];

  if (!session) {
    return {
      messages: [{ type: 'text', text: '「分析開始」と送ってから始めてくださいね。' }]
    };
  }

  if (!session.selectedCategory) {
    if (typeof userMessage === 'string' && questionSets[userMessage]) {
      session.selectedCategory = userMessage;
      session.currentStep = 1;
      session.answers = [];

      const questionKey = questionSets[userMessage]['Q1'];
      const flex = await buildQuestionFlex(questionKey);
      return { messages: [flex] };
    } else {
      return {
        messages: [
          { type: 'text', text: '主訴の選択が正しくありませんでした。もう一度お試しください。' },
          buildCategorySelectionFlex(),
        ]
      };
    }
  }

  const choice = userMessage.split('_').pop();
  session.answers.push(choice);
  session.currentStep++;

  const category = session.selectedCategory;
  const questionSet = questionSets[category];

  if (!questionSet) {
    return {
      messages: [{ type: 'text', text: '該当する質問が見つかりませんでした。' }]
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
      ]
    };
  } else {
    const result = await handleAnswers(session.answers, session.selectedCategory);
    const [score1, score2, score3] = result.scores || [];

    // 🧠 分析コード生成処理（01〜25、1〜4、1〜5 → 4桁コードに変換）
    let code = '';
    try {
      const typeCode = typeCodeDictionary[result.type] || '00';
      const flowCode = flowCodeDictionary[result.flowType] || '0';
      const organCode = organCodeDictionary[result.organType] || '0';

      code = `${typeCode}${flowCode}${organCode}`;
    } catch (err) {
      console.error('❌ 分析コード生成エラー:', err);
    }

    try {
      await saveContext(
        userId,
        score1,
        score2,
        score3,
        result.flowType,
        result.organType,
        result.type,
        result.traits,
        result.adviceCards,
        result.symptom || "未設定",
        result.motion || "未設定",
        code // 🆕 保存（4桁）
      );
    } catch (err) {
      console.error("❌ Supabase保存失敗:", err);
    }

    delete userSessions[userId];


    // Flexバブル（ケアガイド誘導）
    const guideFlex = {
      type: 'flex',
      altText: 'ととのうケアガイドのご案内',
      contents: {
        type: 'bubble',
        size: 'mega',
        body: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#F8F9F7',
          paddingAll: '16px',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: '📗 ととのうケアガイド完成！',
              weight: 'bold',
              size: 'lg',
              color: '#B78949',
              wrap: true
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'text',
              text: 'あなた専用のケアアドバイスができました！生活習慣のヒントやセルフケア方法をチェックしてみましょう ✨',
              size: 'sm',
              color: '#0d0d0d',
              wrap: true
            },
            {
              type: 'text',
              text: '※ あとからメニュー内「ととのうケアガイド」でも確認できます。',
              size: 'xs',
              color: '#888888',
              wrap: true,
              margin: 'md'
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'button',
              style: 'primary',
              color: '#758A6D',
              action: {
                type: 'message',
                label: 'ととのうケアガイドを見る🎁',
                text: 'ととのうケアガイド'
              }
            }
          ]
        }
      }
    };

    const imageUrl = typeImageDictionary[result.type];
    const resultFlex = buildResultFlex(result, imageUrl);

    return {
      messages: [
        resultFlex,
        guideFlex
      ]
    };
  }
}

async function handleExtraCommands(userId, messageText) {
  if (messageText.includes("ととのうケアガイド")) {
    try {
      const context = await getContext(userId);

      if (!context || !context.advice) {
        return {
          messages: [
            {
              type: 'text',
              text: '分析データが見つかりませんでした。もう一度分析をお願いします。'
            }
          ]
        };
      }

      const carousel = buildCarouselFlex(context.advice);
      const isFirstTime = !context.guide_received;

      if (isFirstTime) {
        await markGuideReceived(userId);
        const trialFlex = buildTrialStartFlex();

        return {
          messages: [
            carousel,
            {
              type: 'flex',
              altText: trialFlex.altText,
              contents: trialFlex.contents
            }
          ]
        };
      } else {
        return {
          messages: [carousel]
        };
      }
    } catch (err) {
      console.error("❌ context取得エラー:", err);
      return {
        messages: [
          {
            type: 'text',
            text: '分析データ取得時にエラーが発生しました。もう一度お試しください。'
          }
        ]
      };
    }
  }

  return null;
}

function startSession(userId) {
  userSessions[userId] = {
    currentStep: 0,
    selectedCategory: null,
    answers: [],
  };

  initializeUser(userId).catch(err => {
    console.error("❌ ユーザー初期化エラー:", err);
  });
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
