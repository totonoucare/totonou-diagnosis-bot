const express = require("express");
const line = require("@line/bot-sdk");
const diagnosis = require("./diagnosis/index");
const handleFollowup = require("./followup/index");
const supabase = require("./supabaseClient");
const { buildCategorySelectionFlex } = require("./utils/flexBuilder");
const stripeCheckout = require('./routes/stripeCheckout');

const app = express();
const port = process.env.PORT || 3000;

// ✅ LINE設定（署名検証などに必要）
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);

// ✅ Stripe Webhook専用ルート（rawBodyが必要）
app.use('/webhook/stripe', express.raw({ type: 'application/json' }), require('./stripeWebhook'));

// ✅ その他のルートでは普通に JSON パース
app.use(express.json());
app.use('/', stripeCheckout);

// 🔹 LINE Webhook
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

      // 🔹 紹介トライアル導入
      if (event.type === "postback" && event.postback.data === "trial_intro_done") {
        try {
          const { data, error } = await supabase
            .from("users")
            .update({
              trial_intro_done: true,
              trial_intro_at: new Date().toISOString(),
            })
            .eq("line_id", lineId);

          if (error) throw error;

          await client.replyMessage(event.replyToken, {
            type: "text",
            text: "🎁ご紹介ありがとうございます！\n8日間の無料トライアルがスタートしました！",
          });
        } catch (err) {
          console.error("❌ trial_intro_done 登録エラー:", err);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: "トライアル登録時にエラーが発生しました。もう一度お試しください。",
          });
        }
        return;
      }

      // 🔹 サブスク希望
      if (userMessage === "サブスク希望") {
        const lineId = event.source?.userId || '';
        const subscribeUrl = `https://totonoucare.com/subscribe/?line_id=${lineId}`;

        try {
          await client.replyMessage(event.replyToken, {
            type: "text",
            text:
              "サブスクのご希望ありがとうございます❗️\n\n" +
              "以下のページからプランをお選びいただけます👇\n" +
              `${subscribeUrl}\n\n` +
              "決済が完了すると、自動的にLINE機能が有効化されます🎁",
          });
        } catch (err) {
          console.error("❌ サブスク希望返信エラー:", err);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: "サブスク案内の送信中にエラーが発生しました。もう一度お試しください。",
          });
        }
        return;
      }

      // 🔹 定期チェック診断
      if (userMessage === "定期チェック診断" || handleFollowup.hasSession?.(lineId)) {
        try {
          const messages = await handleFollowup(event, client, lineId);

          if (Array.isArray(messages) && messages.length > 0) {
            await client.replyMessage(event.replyToken, messages);
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

      // 🔹 診断スタート
      if (userMessage === "診断開始") {
        diagnosis.startSession(lineId);
        const flex = buildCategorySelectionFlex();
        await client.replyMessage(event.replyToken, flex);
        return;
      }

      // 🔹 診断セッション中
      if (diagnosis.hasSession(lineId)) {
        const result = await diagnosis.handleDiagnosis(lineId, userMessage, event);
        if (result.sessionUpdate) result.sessionUpdate(userMessage);
        await client.replyMessage(event.replyToken, result.messages);
        return;
      }

      // 🔹 その他の追加コマンド
      const extraResult = await diagnosis.handleExtraCommands(lineId, userMessage);
      if (extraResult) {
        await client.replyMessage(event.replyToken, extraResult.messages);
        return;
      }

      // ❓ その他のメッセージ
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

// 🔹 確認用エンドポイント
app.get("/", (req, res) => {
  res.send("Totonou Diagnosis Bot is running.");
});

// 🔹 サーバー起動
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
