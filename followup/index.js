// followup/index.js
// ===============================================
// 「ととのい度チェック」週次チェックフロー（新仕様）
// Q1: 主訴ふくむ体調 / Q2: 生活リズム / Q3: 動作テスト
// - ケア実施状況は質問しない（carelogで別記録）
// - 回答後はトトノウくんGPTで2枚のカード(card1/card2)を生成し、pushで返す
// ===============================================

const questionSets = require("./questionSets");
const handleFollowupAnswers = require("./followupRouter");
const supabaseMemoryManager = require("../supabaseMemoryManager");
const { MessageBuilder, buildMultiQuestionFlex } = require("../utils/flexBuilder");

// ======== ラベル定義 ========
// ユーザー表示用の日本語ラベルを入れる
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

// どの動きが「つらさチェック対象」か（初回診断で決めているやつ）
const motionLabels = {
  A: "首を後ろに倒すor左右に回す",
  B: "腕をバンザイする",
  C: "前屈する",
  D: "腰を左右にねじるor側屈",
  E: "上体をそらす",
};

// Qごとの小見出しで使うラベル
const multiLabels = {
  symptom: "「{{symptom}}」を含む体調レベル",
  sleep: "睡眠の状態",
  meal: "食事の状態",
  stress: "ストレスの状態",
  motion_level: "動作テストの変化",
};

// ======== セッション管理（メモリベース） ========
const userSession = {};

// ======== テンプレ内の {{symptom}} / {{motion}} を置き換える ========
function replacePlaceholders(template, context = {}) {
  if (!template || typeof template !== "string") return "";
  return template
    .replace(/\{\{symptom\}\}/g, symptomLabels[context.symptom] || "不明な主訴")
    .replace(
      /\{\{motion\}\}/g,
      motionLabels[context.motion] || context.motion || "指定の動作"
    );
}

// ======== 2枚の結果Flexを組み立てる ========
// sections.card1 と sections.card2 を LINE Flex Bubble ×2 にして返す
function buildResultFlexBubbles(sections) {
  const card1 = sections?.card1 || {};
  const card2 = sections?.card2 || {};

  // カード1：今の状態まとめ＋今週の方向性
  const bubble1 = {
    type: "flex",
    altText: "ととのい度チェック：今の状態",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "📊 今のコンディション",
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
          // 本文
          {
            type: "text",
            text: card1.body || "",
            wrap: true,
            size: "md",
            color: "#333333",
          },
        ],
      },
    },
  };

  // カード2：優先ケアプラン（優先順位・頻度つき）
  const carePlanList = Array.isArray(card2.care_plan) ? card2.care_plan : [];
  const carePlanText = carePlanList
    .sort((a, b) => (a.priority || 999) - (b.priority || 999))
    .map((p) => {
      const title = p.pillar
        ? `【${p.priority || 1}位】${p.pillar}（${p.recommended_frequency || "目安"}）`
        : "ケア";
      const reason = p.reason ? p.reason : "";
      const link = p.reference_link ? `図解: ${p.reference_link}` : "";
      return `${title}\n${reason}${link ? "\n" + link : ""}`;
    })
    .join("\n\n");

  const bubble2 = {
    type: "flex",
    altText: "今週のケアプラン",
    contents: {
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
            text: card2.lead || "今週はこの順で整えていこう🌿",
            wrap: true,
            size: "md",
            color: "#333333",
          },
          {
            type: "text",
            text: carePlanText || "まずは一つだけでOK。ムリなくいこうね😊",
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
              "コツコツできてるから大丈夫だよ🙆‍♀️ あなたのペースでいこう。",
            wrap: true,
            size: "xs",
            color: "#888888",
          },
        ],
      },
    },
  };

  return [bubble1, bubble2];
}

// ======== 質問用のFlexを組み立てる ========
// questionSets の各ステップを LINE のボタンUIに変換する
function buildFlexMessage(question, context = {}) {
  if (question.isMulti && Array.isArray(question.options)) {
    // 1つのバブルの中に複数小問（sleep / meal / stress みたいなやつ）
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

  // 単一回答（例：動作テスト）
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

// ======== メイン：ユーザーごとのフロー管理 ========
async function handleFollowup(event, client, lineId) {
  try {
    const replyToken = event.replyToken;

    // ユーザーの発話 or postbackを取り出す
    let message = "";
    if (event.type === "message" && event.message.type === "text") {
      message = event.message.text.trim();
    } else if (event.type === "postback" && event.postback.data) {
      message = event.postback.data.trim();
    } else {
      return client.replyMessage(replyToken, [
        {
          type: "text",
          text: "形式が不正です。ボタンで回答してください🙏",
        },
      ]);
    }

    // 1) 「ととのい度チェック開始」トリガー
    if (message === "ととのい度チェック開始") {
      const userRecord = await supabaseMemoryManager.getUser(lineId);

      // 利用権限チェック（サブスク or トライアル中）
      if (
        !userRecord ||
        (!userRecord.subscribed && !userRecord.trial_intro_done)
      ) {
        await client.replyMessage(replyToken, [
          {
            type: "text",
            text:
              "この機能はサブスク/お試し期間中の方限定です🙏\nメニュー内「サービス案内」から登録できます✨",
          },
        ]);
        return;
      }

      // セッション開始
      userSession[lineId] = { step: 1, answers: {}, partialAnswers: {} };

      // 最初の質問（Q1）
      const q1 = questionSets[0];
      const context = await supabaseMemoryManager.getContext(lineId);

      return client.replyMessage(replyToken, [
        buildFlexMessage(q1, context),
      ]);
    }

    // 2) セッションがないのに回答だけ来たとき
    if (!userSession[lineId]) {
      return client.replyMessage(replyToken, [
        {
          type: "text",
          text: '始めるには「ととのい度チェック開始」を押してください😊',
        },
      ]);
    }

    // セッションあり：現在のステップを取得
    const session = userSession[lineId];
    const currentStep = session.step;
    const question = questionSets[currentStep - 1];

    // === マルチ質問（Q1やQ2みたいに複数小問をまとめて聞くやつ） ===
    if (question.isMulti && Array.isArray(question.options)) {
      // 期待フォーマット "sleep:3" みたいなやつ
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
      const validKey = question.options.find((opt) => opt.id === key);
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

      // まだ未回答の小問がある？
      const remaining = question.options
        .map((sub) => sub.id)
        .filter((k) => !(k in session.partialAnswers));

      if (remaining.length > 0) {
        // まだ聞ききってないので、ここでは何も返さず終了
        // （LINEのボタンはその都度押してくれる想定）
        return;
      }

      // 全部そろったら answers に落とす
      Object.assign(session.answers, session.partialAnswers);
      session.partialAnswers = {};
      session.step++;
    } else {
      // === 単一質問（Q3: 動作テスト = motion_level） ===
      const validDataValues = question.options.map((opt) => opt.data);
      if (!validDataValues.includes(message)) {
        return client.replyMessage(replyToken, [
          {
            type: "text",
            text: "選択肢からお選びください🙏",
          },
        ]);
      }

      // 期待フォーマット "Q3=4" みたいなのから数値だけ取り出す
      let value = message;
      if (value.includes("=")) {
        const num = parseInt(value.split("=")[1]);
        value = isNaN(num) ? null : num;
      }

      session.answers.motion_level = value;
      session.step++;
    }

    // 3) 全質問に回答し終わったらこのブロックに入る
    if (session.step > questionSets.length) {
      const answers = session.answers;

      // ---- Supabase保存（followupsテーブル）----
      await supabaseMemoryManager.setFollowupAnswers(lineId, answers);

      // ---- 返信：まずは「集計中」メッセージをreply ----
      await client.replyMessage(replyToken, [
        {
          type: "text",
          text:
            "✅ チェック完了！\nトトノウくんが今週のケアプランをまとめてるよ🧠🌿\nまもなくお届けします🙏",
        },
      ]);

      // ---- GPTによる2枚カード生成 → push送信 ----
      handleFollowupAnswers(lineId, answers)
        .then(async (result) => {
          try {
            if (result && result.sections) {
              const bubbles = buildResultFlexBubbles(result.sections);
              await client.pushMessage(lineId, bubbles);
            } else {
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
          console.error("❌ GPTコメント生成失敗:", err);
          await client.pushMessage(lineId, [
            {
              type: "text",
              text:
                "今週のケアプランを作るところでエラーが出ました🙇\n少し時間をおいて、また送ってみてください。",
            },
          ]);
          delete userSession[lineId];
        });

      return;
    }

    // 4) まだ質問が残っているなら次の質問をreply
    const nextQuestion = questionSets[session.step - 1];
    const nextContext = await supabaseMemoryManager.getContext(lineId);

    return client.replyMessage(replyToken, [
      {
        type: "flex",
        altText: replacePlaceholders(nextQuestion.header, nextContext),
        contents: buildFlexMessage(nextQuestion, nextContext).contents,
      },
    ]);
  } catch (err) {
    console.error("❌ followup/index.js エラー:", err);
    return client.replyMessage(replyToken, [
      {
        type: "text",
        text: "エラーが発生しました。時間をおいて再試行してください🙏",
      },
    ]);
  }
}

// hasSessionは server.js 側で「今この人はfollowup進行中？」の判定で使う
module.exports = Object.assign(handleFollowup, {
  hasSession: (lineId) => !!userSession[lineId],
});
``` ✅これが完成版です。

---

### これで揃ったこと
- Q3削除済み（ケア実施度は質問しない）
- carelogは responseSender 側で使う前提
- 2枚カード（card1/card2）を index.js 側で Flex Bubble 2つに変換
- 「分析中です🙏」は reply、「最終結果」は push
- `hasSession()` は今まで通り server.js から使える

このまま差し替えてOKです💪
