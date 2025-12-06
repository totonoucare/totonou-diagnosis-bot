// carelog/index.js
const {
  addCareLogDailyByLineId,
  getAllCareCountsRawByLineId,
  getContext,
} = require("../supabaseMemoryManager");
const { generatePraiseReply, buildCareButtonsFlex } = require("./gptPraise");

/** 実施記録の受信イベントを処理する */
module.exports = async function handleCarelog(
  event,
  client,
  lineId,
  userMessage
) {
  // 実施記録メニュー呼び出し
  if (userMessage === "実施記録") {
    try {
      let adviceCards = [];
      try {
        const context = await getContext(lineId);
        if (Array.isArray(context?.advice)) {
          adviceCards = context.advice;
        }
      } catch (e) {
        console.warn("⚠️ getContext 取得失敗（実施記録ボタン）:", e.message);
      }

      const flex = buildCareButtonsFlex({ adviceCards });
      await client.replyMessage(event.replyToken, flex);
    } catch (err) {
      console.error("❌ carelog 実施記録メニュー error:", err);
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "実施記録メニューの表示に失敗しました。時間をおいてお試しください。",
      });
    }
    return true; // handled
  }

  // 実施完了メッセージ（例: ストレッチケア完了☑️）
  const CARE_BY_TEXT = {
    "体質改善習慣完了☑️": "habits",
    "呼吸法完了☑️": "breathing",
    "ストレッチ完了☑️": "stretch",
    "ツボケア完了☑️": "tsubo",
    "漢方・サプリ服用完了☑️": "kampo",
  };

  const pillarKey = CARE_BY_TEXT[userMessage];

  if (pillarKey) {
    try {
      // 1日分 +1 カウント
      await addCareLogDailyByLineId(lineId, pillarKey);

      // 累計回数（全ケア分）
      const countsAll = await getAllCareCountsRawByLineId(lineId);

      // 褒めコメント＆ミニフレックス生成
      const { text, miniFlex } = await generatePraiseReply({
        lineId,
        pillarKey,
        countsAll,
      });

      const messages = [
        {
          type: "text",
          text: `✅ 記録しました\n${text}`,
        },
      ];

      if (miniFlex) {
        messages.push(miniFlex);
      }

      await client.replyMessage(event.replyToken, messages);
    } catch (err) {
      console.error("❌ carelog error:", err);
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "記録に失敗しました。時間をおいてお試しください。",
      });
    }
    return true; // handled
  }

  return false; // 未該当
};
