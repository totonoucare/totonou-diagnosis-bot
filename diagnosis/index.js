const questionSets = require('./questionSets');
const typeImageDictionary = require('./typeImageDictionary');
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
        result.motion || "未設定"
      );
    } catch (err) {
      console.error("❌ Supabase保存失敗:", err);
    }

    delete userSessions[userId];

    // 🆕 Flexバブルで「ととのうケアガイド」誘導ボタンを作成
    const guideFlex = {
      type: 'flex',
      altText: 'ととのうケアガイドのご案内',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: '🧠 あなた専用の「ととのうケアガイド」が完成しました📗✨',
              weight: 'bold',
              size: 'md',
              wrap: true
            },
            {
              type: 'text',
              text: 'セルフケア法・生活習慣アドバイスを今すぐチェック👀\n※メニュー内「ととのうケアガイド」でも再確認できます！',
              size: 'sm',
              wrap: true
            },
            {
              type: 'button',
              style: 'primary',
              color: '#788972',
              action: {
                type: 'message',
                label: '🧭 ととのうケアガイドを見る',
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

async function handleExtraCommands(userId, messageText) {
  if (messageText.includes("ととのうケアガイド")) {
    try {
      const context = await getContext(userId);

      if (!context || !context.advice) {
        return {
          messages: [
            {
              type: 'text',
              text: '診断データが見つかりませんでした。もう一度診断をお願いします。'
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
              type: 'text',
              text: `🔄 「ととのう習慣」で、変わる毎日へ🌱

ととのう体質ケア分析、おつかれさまでした！

ここからは、【ととのうケアガイド】をもとに、「実践→振り返り」のサイクルを無理なく続けていくことがポイントです！🎯

📩 「1人では続かない」という方には、、、習慣化サブスクサービスをご用意！

詳しくはこちら💁
https://totonoucare.com/#menu

さらに今なら、
LINE診断を身近な人に紹介すると、スタンダードコースの8日間無料体験がスタート🎁

👉 今すぐ始めたい方は、ご紹介＆下記の完了ボタンを押して始めましょう！
（紹介リンクは、メニューバー【身近な人に紹介】ボタンでご確認下さい）`
            },
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
            text: '診断データ取得時にエラーが発生しました。もう一度お試しください。'
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
