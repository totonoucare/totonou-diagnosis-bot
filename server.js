const express = require("express");
const line = require("@line/bot-sdk");
const diagnosis = require("./diagnosis/index");
const handleFollowup = require("./followup/index");
const supabase = require("./supabaseClient");
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
      const lineId = event.source?.userId;
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

      if (userMessage === "サブスク希望") {
        try {
          const { error } = await supabase
            .from("users")
            .update({
              subscribed: true,
              subscribed_at: new Date().toISOString(),
            })
            .eq("line_id", lineId);

          if (error) throw error;

          await client.replyMessage(event.replyToken, {
            type: "text",
            text:
              "サブスクのご希望ありがとうございます❗️\n\n" +
              "只今8日間の無料お試し期間実施中につき、サブスク限定機能をまずは8日間無料で解放します！🎁\n\n" +
              "リマインド機能やメニューバーの【定期チェック診断】をぜひご体験ください✨\n\n" +
              "『Myととのうガイド』もメニューのボタンで繰り返し確認＆実践してくださいね！📗",
          });
        } catch (err) {
          console.error("❌ サブスク登録エラー:", err);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: "サブスク登録時にエラーが発生しました。もう一度お試しください。",
          });
        }
        return;
      }

      if (userMessage === "定期チェック診断" || handleFollowup.hasSession?.(lineId)) {
        try {
          const messages = await handleFollowup(event, client, lineId);

          if (Array.isArray(messages) && messages.length > 0) {
            const hasPushOnly = messages.some(m => m?.pushOnly);

            if (hasPushOnly) {
              // 分割して送信（pushOnlyだけ pushMessage）
              for (const m of messages) {
                if (m.pushOnly) {
                  await client.pushMessage(lineId, m.message);
                } else {
                  await client.replyMessage(event.replyToken, [m]);
                }
              }
            } else {
              await client.replyMessage(event.replyToken, messages);
            }
          } else if (!handleFollowup.hasSession(lineId)) {
            await client.replyMessage(event.replyToken, {
              type: "text",
              text: "定期チェック診断を始めるには、メニューバーの【定期チェック診断】をタップしてください。",
            });
          }
        } catch (err) {
          console.error("❌ handleFollowup エラー:", err);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: "再診処理中にエラーが発生しました。もう一度お試しください。",
          });
        }
        return;
      }

      if (userMessage === "診断開始") {
        diagnosis.startSession(lineId);
        const flex = buildCategorySelectionFlex();
        await client.replyMessage(event.replyToken, flex);
        return;
      }

      if (diagnosis.hasSession(lineId)) {
        const result = await diagnosis.handleDiagnosis(lineId, userMessage, event);
        if (result.sessionUpdate) result.sessionUpdate(userMessage);
        await client.replyMessage(event.replyToken, result.messages);
        return;
      }

      const extraResult = await diagnosis.handleExtraCommands(lineId, userMessage);
      if (extraResult) {
        await client.replyMessage(event.replyToken, extraResult.messages);
        return;
      }

      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `メッセージありがとうございます😊
スタンダード会員様へのご相談には24時間以内にお返事しますね！
お問い合わせやエラー報告にも迅速にお返事・ご対応いたします。
しばらくお待ちください。`,
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
