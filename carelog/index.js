// carelog/index.js
const { addCareLogDailyByLineId, getAllCareCountsRawByLineId } = require("../supabaseMemoryManager");
const { generatePraiseReply, buildCareButtonsFlex } = require("./gptPraise");

/** 実施記録の受信イベントを処理する */
module.exports = async function handleCarelog(event, client, lineId, userMessage) {
  // 実施記録ボタン呼び出し
  if (userMessage === "実施記録") {
    const flex = buildCareButtonsFlex();
    await client.replyMessage(event.replyToken, flex);
    return true; // handled
  }

  // 実施完了メッセージ（例: ストレッチケア完了☑️）
  const CARE_BY_TEXT = {
    "体質改善習慣完了☑️": "habits",
    "呼吸法完了☑️": "breathing",
    "ストレッチ完了☑️": "stretch",
    "ツボケア完了☑️": "tsubo",
    "漢方・サプリ完了☑️": "kampo",
  };
  const pillarKey = CARE_BY_TEXT[userMessage];
  if (pillarKey) {
    try {
      await addCareLogDailyByLineId(lineId, pillarKey);
      const countsAll = await getAllCareCountsRawByLineId(lineId);
      const praise = await generatePraiseReply({ lineId, pillarKey, countsAll });
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `✅ 記録しました\n${praise}`,
      });
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
