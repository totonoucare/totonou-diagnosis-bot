require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const diagnosis = require("./diagnosis/index");
const handleFollowup = require("./followup/index");
const supabaseMemoryManager = require("./supabaseMemoryManager");
const { buildCategorySelectionFlex } = require("./utils/flexBuilder");

const app = express();
const port = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

app.post("/webhook", line.middleware(config), async (req, res) => {
  const events = req.body.events;

  const results = await Promise.all(
    events.map(async (event) => {
      const userId = event.source?.userId;
      let userMessage = null;

      if (event.type === "message" && event.message.type === "text") {
        userMessage = event.message.text.trim();
      } else if (event.type === "postback") {
        userMessage = event.postback.data;
      } else {
        return null;
      }

      console.log("🔵 event.type:", event.type);
      console.log("🟢 userMessage:", userMessage);

      // ✅ サブスク登録リクエスト
      if (userMessage === "サブスク希望") {
        try {
          await supabaseMemoryManager.markSubscribed(userId);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: "サブスク登録ありがとうございます！\n\n次回から「ケア状況分析＆見直し」で再診が可能です✨",
          });
        } catch (err) {
          console.error("❌ markSubscribed エラー:", err);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: "サブスク登録時にエラーが発生しました。もう一度お試しください。",
          });
        }
        return;
      }

      // ✅ フォローアップ診断（再診スタート or セッション中）
      if (userMessage === "ケア状況分析&見直し" || handleFollowup.hasSession?.(userId)) {
        const messages = await handleFollowup(event, client, userId);
        if (messages?.length > 0) {
          await client.replyMessage(event.replyToken, messages);
        }
        return;
      }

      // ✅ 診断スタート
      if (userMessage === "診断開始") {
        diagnosis.startSession(userId);
        const flex = buildCategorySelectionFlex();
        await client.replyMessage(event.replyToken, flex);
        return;
      }

      // ✅ 診断セッション中
      if (diagnosis.hasSession(userId)) {
        const result = await diagnosis.handleDiagnosis(userId, userMessage, event);
        if (result.sessionUpdate) result.sessionUpdate(userMessage);
        await client.replyMessage(event.replyToken, result.messages);
        return;
      }

      // ✅ その他の追加コマンド（ととのうガイドなど）
      const extraResult = await diagnosis.handleExtraCommands(userId, userMessage);
      if (extraResult) {
        await client.replyMessage(event.replyToken, extraResult.messages);
        return;
      }

      // ❓どの条件にも該当しない入力
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "メニューから「診断開始」を選んで始めてください。",
      });
    })
  );

  res.json(results);
});

app.get("/", (req, res) => {
  res.send("Totonou Diagnosis Bot is running.");
});

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
