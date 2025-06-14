const questionSets = require('./questionSets');
const { buildQuestionFlex, buildCategorySelectionFlex, buildCarouselFlex } = require('../utils/flexBuilder');
const { handleAnswers } = require('./answerRouter');
const { setInitialContext } = require('../memoryManager'); // ← 再診用context保存

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
    const displayText = rawEvent?.postback?.displayText || `あなたの選択：${choice}`;

    return {
      messages: [
        { type: 'text', text: displayText },
        flex,
      ],
    };
  } else {
    // ✅ すべての質問完了 → 診断結果生成
    const result = await handleAnswers(session.answers);

    // ✅ 初回診断の記録を保存（delete より先に！）
    setInitialContext(userId, {
      symptom: category,
      motion: session.answers[4], // Q5：動作テスト
      typeName: result.type,
      traits: result.traits,
      flowIssue: result.flowIssue,
      organBurden: result.organBurden,
      planAdvice: result.adviceCards,
      link: result.link
    });

    // ✅ セッション削除は保存の後
    delete userSessions[userId];

    // ✅ カルーセル用カードを結合（アドバイス4つ＋漢方薬1つ）
    const carouselCards = [...result.adviceCards];
    carouselCards.push({
      header: "🌿おすすめ漢方薬",
      body: result.link
    });

    const carousel = buildCarouselFlex(carouselCards);

    return {
      messages: [
        { type: 'text', text: `【📝あなたのベース体質】\n\n${result.type}` },
        { type: 'text', text: `【🧭体質解説と改善ナビ】\n\n${result.traits}` },
        { type: 'text', text: `【🌀巡りの傾向】\n\n${result.flowIssue}` },
        { type: 'text', text: `【🫁内臓への負担傾向】\n\n${result.organBurden}` },
        carousel
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
