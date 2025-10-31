// carelog/index.jsconst {
  addCareLogDailyByLineId,
  getAllCareCountsRawByLineId, // ← 変更！
} = require("../supabaseMemoryManager");
const { generatePraiseReply, buildCareButtonsFlex } = require("./gptPraise");

module.exports = async function handleCarelog(event, client, lineId, userMessage) {
  if (userMessage === "実施記録") {
    const flex = buildCareButtonsFlex();
    await client.replyMessage(event.replyToken, flex);
    return true;
  }

  const CARE_BY_TEXT = {
    "体質改善習慣ケア完了☑️": "habits",
    "呼吸法ケア完了☑️": "breathing",
    "ストレッチケア完了☑️": "stretch",
    "ツボケア完了☑️": "tsubo",
    "漢方ケア完了☑️": "kampo",
  };
  const pillarKey = CARE_BY_TEXT[userMessage];

  if (pillarKey) {
    try {
      // 1️⃣ 実施回数を記録
      await addCareLogDailyByLineId(lineId, pillarKey);

      // 2️⃣ 丸めない全期間データを取得（努力量を正確に反映）
      const countsAll = await getAllCareCountsRawByLineId(lineId);

      // 3️⃣ GPTに渡して褒め文生成
      const praise = await generatePraiseReply({ pillarKey, countsAll });

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
    return true;
  }

  return false;
};
