// server.js
require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const diagnosis = require("./diagnosis/index");
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

      // ユーザーからの入力取得
      if (event.type === "message" && event.message.type === "text") {
        userMessage = event.message.text.trim();
      } else if (event.type === "postback") {
        userMessage = event.postback.data;
      } else {
        return null;
      }

      // 診断スタート
      if (userMessage === "診断開始") {
        diagnosis.startSession(userId);
        const flex = buildCategorySelectionFlex();
        await client.replyMessage(event.replyToken, [flex]);
        return;
      }

      // セッションが存在しない場合は無視
      if (!diagnosis.hasSession(userId)) {
        return null;
      }

      // 🟡 await を追加（ここが重要！）
      const result = await diagnosis.handleDiagnosis(userId, userMessage);

      if (result.sessionUpdate) {
        result.sessionUpdate(userMessage);
      }

      await client.replyMessage(event.replyToken, result.messages);
    })
  );

  res.json(results);
});

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
