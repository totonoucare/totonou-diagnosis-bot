// server.js
require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const diagnosisHandler = require("./diagnosis/index");

const app = express();
const port = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// LINE Webhookの受け取りエンドポイント
app.post("/webhook", line.middleware(config), async (req, res) => {
  const events = req.body.events;
  const results = await Promise.all(
    events.map((event) => diagnosisHandler(event, client))
  );
  res.json(results);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
