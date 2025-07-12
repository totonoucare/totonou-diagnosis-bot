const express = require("express");
const line = require("@line/bot-sdk");
const diagnosis = require("./diagnosis/index");
const handleFollowup = require("./followup/index");
const supabase = require("./supabaseClient");
const { buildCategorySelectionFlex } = require("./utils/flexBuilder");
const stripeWebhook = require("./stripeWebhook");
const stripeCheckout = require("./routes/stripeCheckout");

const app = express();
const port = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);

// ✅ LINE Webhook
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

      // ご案内リンク
      if (userMessage === "各種ご案内リンク") {
        const subscribeUrl = `https://totonoucare.com/subscribe/?line_id=${lineId}`;
        const flex = {
          type: "flex",
          altText: "各種ご案内リンク",
          contents: {
            type: "bubble",
            size: "mega",
            header: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "📎 ご案内リンク",
                  weight: "bold",
                  size: "lg",
                  color: "#ffffff"
                }
              ],
              backgroundColor: "#788972",
              paddingAll: "12px"
            },
            body: {
              type: "box",
              layout: "vertical",
              spacing: "md",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  color: "#788972",
                  action: {
                    type: "message",
                    label: "🤝 身近な人に紹介",
                    text: "身近な人に紹介"
                  }
                },
                {
                  type: "button",
                  style: "primary",
                  color: "#788972",
                  action: {
                    type: "uri",
                    label: "🔐 サブスク登録 / 解約",
                    uri: subscribeUrl
                  }
                },
                {
                  type: "button",
                  style: "primary",
                  color: "#788972",
                  action: {
                    type: "uri",
                    label: "🖥️ オンライン相談予約",
                    uri: "https://kenkounihari.seirin.jp/clinic/18212/reserve"
                  }
                },
                {
                  type: "button",
                  style: "primary",
                  color: "#788972",
                  action: {
                    type: "uri",
                    label: "🌐 ホームページ",
                    uri: "https://totonoucare.com"
                  }
                }
              ]
            }
          }
        };

        await client.replyMessage(event.replyToken, flex);
        return;
      }

      // 紹介テンプレ
      if (userMessage === "身近な人に紹介") {
        const shareUrl = "https://lin.ee/UxWfJtV";
        await client.replyMessage(event.replyToken, [
          {
            type: "text",
            text: "ご紹介ありがとうございます✨\n👇こちら紹介文のコピペ用テンプレート文です。ぜひ参考にお使いください！😊",
          },
          {
            type: "text",
            text:
              "最近、自分の不調の根本をAIが診断してくれるLINEツールを見つけて、\n参考になりそうだからシェアするね！\n\n体質診断→セルフケア提案まで無料であるから\n病院に行くほどじゃない不調におすすめ👍",
          },
          {
            type: "text",
            text: `🔗 LINE登録はこちら\n${shareUrl}`,
          },
        ]);
        return;
      }

      // 紹介トライアル記録
      if (event.type === "postback" && userMessage === "trial_intro_done") {
        try {
          const { error } = await supabase
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

      // サブスク希望
      if (userMessage === "サブスク希望") {
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

      // LINEでプロに相談（スタンダード会員 or 紹介トライアル）
      if (userMessage === "LINEでプロに相談") {
        const { data: user, error } = await supabase
          .from("users")
          .select("subscribed, plan_type, remaining_consultations, trial_intro_done")
          .eq("line_id", lineId)
          .single();

        if (error || !user) {
          console.error("❌ ユーザー取得失敗:", error);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: "ユーザー情報の取得中にエラーが発生しました。しばらくしてから再度お試しください。",
          });
          return;
        }

        const hasAccess = (user.subscribed && user.plan_type === "standard") || user.trial_intro_done;

        if (hasAccess) {
          await supabase
            .from("users")
            .update({ last_consult_triggered: new Date().toISOString() })
            .eq("line_id", lineId);

          await client.replyMessage(event.replyToken, {
            type: "text",
            text: `メッセージありがとうございます！\n以下の内容でご相談を承ります☺️\n\n📝 残り相談回数：${user.remaining_consultations}回\n\nご相談内容をこのトーク画面でご自由にお送りください。\n\n例：\n・最近の不調や気になる症状\n・セルフケアのやり方やコツ\n・漢方やツボの詳しい説明\n・診断結果についての質問　など`,
          });
        } else {
          const subscribeUrl = `https://totonoucare.com/subscribe/?line_id=${lineId}`;
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: `この機能は「スタンダード会員様限定」となっております🙏\n以下よりご登録いただくと、LINE相談がご利用可能になります✨\n\n🔗 ${subscribeUrl}`,
          });
        }
        return;
      }



      // ➤ 定期チェック診断
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

      // ➤ 診断スタート
      if (userMessage === "診断開始") {
        diagnosis.startSession(lineId);
        const flex = buildCategorySelectionFlex();
        await client.replyMessage(event.replyToken, flex);
        return;
      }

      // ➤ 診断セッション中
      if (diagnosis.hasSession(lineId)) {
        const result = await diagnosis.handleDiagnosis(lineId, userMessage, event);
        if (result.sessionUpdate) result.sessionUpdate(userMessage);
        await client.replyMessage(event.replyToken, result.messages);
        return;
      }

      // ➤ その他メッセージ → スタンダード相談消費処理
      const { data: user, error } = await supabase
        .from("users")
        .select("subscribed, plan_type, remaining_consultations, last_consult_triggered")
        .eq("line_id", lineId)
        .single();

      if (user && user.subscribed && user.plan_type === "standard" && user.last_consult_triggered) {
        const lastTime = new Date(user.last_consult_triggered);
        const now = new Date();
        const diffMinutes = (now - lastTime) / (1000 * 60);

        if (diffMinutes < 10 && user.remaining_consultations > 0) {
          await supabase
            .from("users")
            .update({
              remaining_consultations: user.remaining_consultations - 1,
              last_consult_triggered: null,
            })
            .eq("line_id", lineId);

          await client.replyMessage(event.replyToken, {
            type: "text",
            text: `ご相談ありがとうございます！\nスタッフが順次お返事いたしますね☺️\n\n📉 残り相談回数：${user.remaining_consultations - 1}回`,
          });
          return;
        }
      }

      // ➤ その他メッセージ（デフォルト返信）
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `メッセージありがとうございます😊\nご相談・お問い合わせには24時間以内にお返事させていただきますね！`,
      });
    })
  );

  res.json(results);
});

// ✅ Stripe Webhook（⚠️ raw 必須）
app.use('/webhook/stripe', express.raw({ type: 'application/json' }), stripeWebhook);

// ✅ Checkout 専用ルート
app.use(express.json());
app.use('/', stripeCheckout);

// ✅ 動作確認用
app.get("/", (req, res) => res.send("Totonou Diagnosis Bot is running."));

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
