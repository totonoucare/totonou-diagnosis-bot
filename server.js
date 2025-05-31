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

// Webhook受信エンドポイント
app.post("/webhook", line.middleware(config), async (req, res) => {
  const events = req.body.events;

  const results = await Promise.all(
    events.map(async (event) => {
      // テキストメッセージ以外は無視
      if (event.type !== "message" || event.message.type !== "text") {
        return null;
      }

      const userId = event.source.userId;
      const userMessage = event.message.text.trim();

      // 「診断開始」だけを診断フローの扉にする
      if (userMessage === "診断開始") {
        diagnosis.startSession(userId); // セッション初期化
        const flex = buildCategorySelectionFlex();
        await client.replyMessage(event.replyToken, [flex]);
        return;
      }

      // セッションがなければ何もしない
      if (!diagnosis.hasSession(userId)) {
        return null;
      }

      // セッション中であれば診断を続行
      const result = diagnosis.handleDiagnosis(userId, userMessage);

      // セッション更新（主訴選択など）
      if (result.sessionUpdate) {
        result.sessionUpdate(userMessage);
      }

      // 質問 or 結果を返信
      await client.replyMessage(event.replyToken, result.messages);
    })
  );

  res.json(results);
});

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
