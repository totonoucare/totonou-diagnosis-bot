// followup/index.js
// ===============================================
// 「ととのい度チェック」週次チェックフロー（最終仕様）
//
// Q1: 主訴ふくむ体調
// Q2: 生活リズム（睡眠/食事/ストレス）
// Q3: 動作テストのつらさ
//
// - ケア実施状況は聞かない（carelogで別管理）
// - 全回答後：
//    1) Supabaseに保存
//    2) 「集計中だよ🧠」をreply
//    3) responseSenderでトトノウくんJSON(card1/card2)生成
//    4) pushでカルーセルを送る
// ===============================================

const questionSets = require("./questionSets");
const handleFollowupAnswers = require("./followupRouter");
const supabaseMemoryManager = require("../supabaseMemoryManager");
const { MessageBuilder, buildMultiQuestionFlex } = require("../utils/flexBuilder");

// ======== ラベル定義 ========
const symptomLabels = {
  stomach: "胃腸の調子",
  sleep: "睡眠・集中力",
  pain: "肩こり・腰痛・関節",
  mental: "イライラや不安感",
  cold: "体温バランス・むくみ",
  skin: "頭髪や肌の健康",
  pollen: "花粉症・鼻炎",
  women: "女性特有のお悩み",
  unknown: "なんとなく不調・不定愁訴",
};

const motionLabels = {
  A: "首を後ろに倒すor左右に回す",
  B: "腕をバンザイする",
  C: "前屈する",
  D: "腰を左右にねじるor側屈",
  E: "上体をそらす",
};

// Qごとの小見出し
const multiLabels = {
  symptom: "「{{symptom}}」を含む体調レベル",
  sleep: "睡眠の状態",
  meal: "食事の状態",
  stress: "ストレスの状態",
  motion_level: "動作テストの変化",
};

// ======== セッション管理 ========
const userSession = {};

// ======== テンプレ置換 ========
function replacePlaceholders(template, context = {}) {
  if (!template || typeof template !== "string") return "";
  return template
    .replace(/\{\{symptom\}\}/g, symptomLabels[context.symptom] || "不明な主訴")
    .replace(
      /\{\{motion\}\}/g,
      motionLabels[context.motion] || context.motion || "指定の動作"
    );
}

/**
 * GPTの sections.card1/card2 から
 * Flex Bubble2枚を組み立てる
 *
 * card1 = 状態まとめ＋スコア
 * card2 = 今週のケアプラン（優先順・頻度つき）
 */
function buildResultFlexBubbles(sections) {
  const card1 = sections?.card1 || {};
  const card2 = sections?.card2 || {};

  // --- bubble1: 今の状態とスコアブロック
  const scoreBlockLines = [];

  // 総合整い度
  if (card1.score_block && card1.score_block.total) {
    const t = card1.score_block.total;
    scoreBlockLines.push(
      `🌿 ${t.label}：${t.stars}\n（${t.color_hint || ""}）`
    );
  }

  // 行動スコア
  if (card1.score_block && card1.score_block.action) {
    const a = card1.score_block.action;
    scoreBlockLines.push(
      `💪 ${a.label}：${a.score_text}\n${a.explain || ""}`
    );
  }

  // 体調反映度
  if (card1.score_block && card1.score_block.reflection) {
    const r = card1.score_block.reflection;
    scoreBlockLines.push(
      `💫 ${r.label}：${r.stars}\n${r.explain || ""}`
    );
  }

  const bubble1 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "📋 今回のととのい度チェック",
          weight: "bold",
          size: "lg",
          color: "#ffffff",
        },
      ],
      backgroundColor: "#758A6D",
      paddingAll: "12px",
      cornerRadius: "12px",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      backgroundColor: "#F8F9F7",
      paddingAll: "12px",
      contents: [
        // リード
        {
          type: "text",
          text: card1.lead || "おつかれさま😊",
          wrap: true,
          size: "md",
          color: "#333333",
        },
        // スコアまとめ
        {
          type: "text",
          text: scoreBlockLines.join("\n\n") || "",
          wrap: true,
          size: "md",
          color: "#333333",
        },
        {
          type: "separator",
          margin: "md",
        },
        // 今週の方向性
        {
          type: "text",
          text:
            card1.guidance ||
            "今の流れはちゃんと積み上がってるよ。このリズムでいこう🌿",
          wrap: true,
          size: "md",
          color: "#333333",
        },
      ],
    },
  };

  // --- bubble2: ケアプラン
  // care_plan配列をテキスト列に
  const carePlanList = Array.isArray(card2.care_plan)
    ? card2.care_plan
    : [];

  const carePlanTexts = carePlanList
    .sort(
      (a, b) =>
        (a.priority || 999) - (b.priority || 999)
    )
    .map((p) => {
      const title = p.pillar
        ? `【${p.priority || 1}位】${p.pillar}（${p.recommended_frequency ||
            "目安"}）`
        : "ケア";
      const reason = p.reason ? p.reason : "";
      const link =
        p.reference_link && p.reference_link.trim() !== ""
          ? `図解・やり方：${p.reference_link}`
          : "";
      // 改行でメリハリ
      return `${title}\n${reason}${link ? "\n" + link : ""}`;
    })
    .join("\n\n");

  const bubble2 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "🧘‍♂️ 今週のケアプラン",
          weight: "bold",
          size: "lg",
          color: "#ffffff",
        },
      ],
      backgroundColor: "#B78949",
      paddingAll: "12px",
      cornerRadius: "12px",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      backgroundColor: "#FDFBF7",
      paddingAll: "12px",
      contents: [
        {
          type: "text",
          text:
            card2.lead || "今週はこの順で整えていこう🌿",
          wrap: true,
          size: "md",
          color: "#333333",
        },
        {
          type: "text",
          text:
            carePlanTexts ||
            "まずは1つ決めて、そこだけでOK🙆‍♀️",
          wrap: true,
          size: "md",
          color: "#333333",
        },
        {
          type: "separator",
          margin: "md",
        },
        {
          type: "text",
          text:
            card2.footer ||
            "一気に全部やろうとしなくて大丈夫。今日は1分だけでもOKだよ🫶",
          wrap: true,
          size: "xs",
          color: "#888888",
        },
      ],
    },
  };

  return [bubble1, bubble2];
}

/**
 * 質問UIをFlexに変換
 * - Q1/Q2みたいなマルチ小問は buildMultiQuestionFlex
 * - Q3みたいな単一選択は MessageBuilder
 */
function buildFlexMessage(question, context = {}) {
  if (question.isMulti && Array.isArray(question.options)) {
    return buildMultiQuestionFlex({
      altText: replacePlaceholders(question.header, context),
      header: replacePlaceholders(question.header, context),
      body: replacePlaceholders(question.body, context),
      questions: question.options.map((opt) => ({
        key: opt.id,
        title: replacePlaceholders(
          multiLabels[opt.id] || opt.label || opt.id,
          context
        ),
        items: opt.items,
      })),
    });
  }

  // 単一回答（動作テストなど）
  return MessageBuilder({
    altText: replacePlaceholders(question.header, context),
    header: replacePlaceholders(question.header, context),
    body: replacePlaceholders(question.body, context),
    buttons: question.options.map((opt) => ({
      label: opt.label,
      data: opt.data,
      displayText: opt.displayText,
    })),
  });
}

/**
 * メイン：ユーザーごとのQAフロー＋結果送信
 */
async function handleFollowup(event, client, lineId) {
  const replyToken = event.replyToken;

  try {
    // ユーザー入力を取得
    let message = "";
    if (
      event.type === "message" &&
      event.message.type === "text"
    ) {
      message = event.message.text.trim();
    } else if (
      event.type === "postback" &&
      event.postback.data
    ) {
      message = event.postback.data.trim();
    } else {
      return client.replyMessage(replyToken, [
        {
          type: "text",
          text: "形式が不正です。ボタンで回答してください🙏",
        },
      ]);
    }

    // === フロー開始トリガー ===
    if (message === "ととのい度チェック開始") {
      const userRecord =
        await supabaseMemoryManager.getUser(lineId);

      // サブスクかトライアル中かチェック
      if (
        !userRecord ||
        (!userRecord.subscribed && !userRecord.trial_intro_done)
      ) {
        await client.replyMessage(replyToken, [
          {
            type: "text",
            text:
              "この機能はご契約/お試し中の方限定です🙏\nメニュー内「サービス案内」から登録できます✨",
          },
        ]);
        return;
      }

      // セッションを初期化
      userSession[lineId] = {
        step: 1,
        answers: {},
        partialAnswers: {},
      };

      // 最初の質問を返す（Q1）
      const q1 = questionSets[0];
      const context =
        await supabaseMemoryManager.getContext(lineId);

      return client.replyMessage(replyToken, [
        buildFlexMessage(q1, context),
      ]);
    }

    // === セッションがないのに回答が来た場合 ===
    if (!userSession[lineId]) {
      return client.replyMessage(replyToken, [
        {
          type: "text",
          text:
            '始めるには「ととのい度チェック開始」を押してください😊',
        },
      ]);
    }

    // === セッションあり ===
    const session = userSession[lineId];
    const currentStep = session.step;
    const question = questionSets[currentStep - 1];

    // --- マルチ型質問 (Q1 / Q2)
    if (question.isMulti && Array.isArray(question.options)) {
      // 期待フォーマット "sleep:3" など
      const parts = message.split(":");
      if (parts.length !== 2) {
        return client.replyMessage(replyToken, [
          {
            type: "text",
            text: "ボタンから選んで送信してください🙏",
          },
        ]);
      }

      const [key, answer] = parts;
      const validKey = question.options.find(
        (opt) => opt.id === key
      );
      if (!validKey) {
        return client.replyMessage(replyToken, [
          {
            type: "text",
            text: "その選択肢は使えません。ボタンから選んでください🙏",
          },
        ]);
      }

      // 一時保存
      session.partialAnswers[key] = answer;

      // 未回答の小問がまだ残ってる？
      const remaining = question.options
        .map((sub) => sub.id)
        .filter(
          (k) => !(k in session.partialAnswers)
        );

      if (remaining.length > 0) {
        // まだ同じQ内で聞ききってないので何も返さず待機
        return;
      }

      // 全小問そろったので answers に確定
      Object.assign(session.answers, session.partialAnswers);
      session.partialAnswers = {};
      session.step++;
    } else {
      // --- 単一型質問 (Q3: 動作テスト = motion_level)
      const validDataValues = question.options.map(
        (opt) => opt.data
      );
      if (!validDataValues.includes(message)) {
        return client.replyMessage(replyToken, [
          {
            type: "text",
            text: "選択肢からお選びください🙏",
          },
        ]);
      }

      // 期待フォーマット "Q3=4" など → 数値だけ取り出し
      let value = message;
      if (value.includes("=")) {
        const num = parseInt(value.split("=")[1]);
        value = isNaN(num) ? null : num;
      }
      session.answers.motion_level = value;
      session.step++;
    }

    // === 全質問に答え終わった？ ===
    if (session.step > questionSets.length) {
      const answers = session.answers;

      // Supabase保存（followups）
      await supabaseMemoryManager.setFollowupAnswers(
        lineId,
        answers
      );

      // まずは「集計中」リプライ
      await client.replyMessage(replyToken, [
        {
          type: "text",
          text:
            "✅ チェック完了！\nトトノウくんが今週のケアプランをまとめてるよ🧠🌿\nこのあとお届けしますね。",
        },
      ]);

      // 集計・GPT生成してpush
      handleFollowupAnswers(lineId, answers)
        .then(async (result) => {
          try {
            if (result && result.sections) {
              // sections={card1,card2} → Flexバブル2枚
              const bubbles =
                buildResultFlexBubbles(result.sections);

              // カルーセルで1push
              await client.pushMessage(lineId, [
                {
                  type: "flex",
                  altText: "ととのい度チェック結果",
                  contents: {
                    type: "carousel",
                    contents: bubbles,
                  },
                },
              ]);
            } else {
              // フォールバック：テキストでまとめ
              await client.pushMessage(lineId, [
                {
                  type: "text",
                  text:
                    "📋 今回のととのい度チェック\n\n" +
                    (result?.gptComment ||
                      "解析コメントをうまく生成できませんでした🙏"),
                },
              ]);
            }
          } finally {
            delete userSession[lineId];
          }
        })
        .catch(async (err) => {
          console.error(
            "❌ GPTコメント生成失敗:",
            err
          );
          await client.pushMessage(lineId, [
            {
              type: "text",
              text:
                "今週のケアプランを作るところでエラーが出ました🙇\n時間をおいてまたチェックしてみてください。",
            },
          ]);
          delete userSession[lineId];
        });

      return;
    }

    // === まだ次の質問がある場合 ===
    const nextQuestion = questionSets[session.step - 1];
    const nextContext =
      await supabaseMemoryManager.getContext(lineId);

    return client.replyMessage(replyToken, [
      {
        type: "flex",
        altText: replacePlaceholders(
          nextQuestion.header,
          nextContext
        ),
        contents: buildFlexMessage(
          nextQuestion,
          nextContext
        ).contents,
      },
    ]);
  } catch (err) {
    console.error("❌ handleFollowup エラー:", err);
    return client.replyMessage(replyToken, [
      {
        type: "text",
        text:
          "エラーが発生しました🙇\n少し時間をおいてもう一度お試しください。",
      },
    ]);
  }
}

// server.js 側で「この人いまfollowup中？」って判定するとき用
module.exports = Object.assign(handleFollowup, {
  hasSession: (lineId) => !!userSession[lineId],
});
