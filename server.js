require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const diagnosis = require("./diagnosis/index");
const handleFollowup = require("./followup/index");
const { buildCategorySelectionFlex } = require("./utils/flexBuilder");

const app = express();
const port = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// ユーザーごとのセッション記録（簡易的にメモリに保持）
const userMemory = {};

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

      // ✅ 「ととのう計画」 or followupセッション中の場合
      if (
        userMessage === "ととのう計画" ||
        require("./followup/index").hasSession?.(userId)
      ) {
        const messages = await handleFollowup(event, client, userId);
        if (messages?.length > 0) {
          await client.replyMessage(event.replyToken, messages);
        }
        return;
      }

      // 通常診断のスタート
      if (userMessage === "診断開始") {
        diagnosis.startSession(userId);
        const flex = buildCategorySelectionFlex();
        await client.replyMessage(event.replyToken, flex);
        return;
      }

      // 通常診断セッション中の処理
      if (diagnosis.hasSession(userId)) {
        const result = await diagnosis.handleDiagnosis(userId, userMessage, event);
        if (result.sessionUpdate) result.sessionUpdate(userMessage);
        await client.replyMessage(event.replyToken, result.messages);
        return;
      }

      return null;
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
