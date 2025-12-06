// carelog/index.js
const {
  addCareLogDailyByLineId,
  getAllCareCountsRawByLineId,
} = require("../supabaseMemoryManager");
const {
  generatePraiseReply,
  buildCareButtonsFlex,
} = require("./gptPraise");

/** 実施記録の受信イベントを処理する */
module.exports = async function handleCarelog(
  event,
  client,
  lineId,
  userMessage
) {
  // 🔘 実施記録ボタン呼び出し
  if (userMessage === "実施記録") {
    const flex = buildCareButtonsFlex();
    await client.replyMessage(event.replyToken, flex);
    return true; // handled
  }

  // ✅ 実施完了メッセージ（例: ストレッチ完了☑️）
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
      // 1) 当日の実施を +1
      await addCareLogDailyByLineId(lineId, pillarKey);

      // 2) 全ケアの累計回数（称号＆マイルストーン用）
      const countsAll = await getAllCareCountsRawByLineId(lineId);

      // 3) 褒めコメント＋ミニフレックス
      const praise = await generatePraiseReply({
        lineId,
        pillarKey,
        countsAll,
      });

      // メインテキスト + 進捗ミニカード（画面を占領しすぎないサイズ）
      const messages = [
        {
          type: "text",
          text: `✅ 記録しました\n${praise.message}`,
        },
      ];

      if (praise.flexContents) {
        messages.push({
          type: "flex",
          altText:
            praise.altText || "ケアの記録状況ミニカード",
          contents: praise.flexContents,
        });
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

  // どのケアにも該当しない
  return false;
};
