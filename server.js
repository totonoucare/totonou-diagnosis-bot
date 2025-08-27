const express = require("express");
const line = require("@line/bot-sdk");
const diagnosis = require("./diagnosis/index");
const handleFollowup = require("./followup/index");
const supabase = require("./supabaseClient");
const {
  buildChatConsultOptionsFlex,
  buildCategorySelectionFlex, 
  buildDiagnosisConfirmFlex, 
  buildFollowupConfirmFlex, 
} = require("./utils/flexBuilder");
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

      // ご案内リンク集
      if (userMessage === "ご案内リンク集") {
        const subscribeUrl = `https://totonoucare.com/subscribe/?line_id=${lineId}`;
        const flex = {
          type: "flex",
          altText: "ご案内リンク集",
          contents: {
            type: "bubble",
            size: "mega",
            header: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "🔗 ご案内リンク",
                  weight: "bold",
                  size: "lg",
                  color: "#ffffff"
                }
              ],
              backgroundColor: "#758A6D",
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
                  color: "#758A6D",
                  action: {
                    type: "message",
                    label: "✉️ 身近な人への紹介",
                    text: "身近な人への紹介"
                  }
                },
                {
                  type: "button",
                  style: "primary",
                  color: "#758A6D",
                  action: {
                    type: "uri",
                    label: "🔐 サブスク登録 / 解約ページ",
                    uri: subscribeUrl
                  }
                },
                {
                  type: "button",
                  style: "primary",
                  color: "#758A6D",
                  action: {
                    type: "uri",
                    label: "🖥️ オンライン相談等 予約ページ",
                    uri: "https://kenkounihari.seirin.jp/clinic/18212/reserve"
                  }
                },
                {
                  type: "button",
                  style: "primary",
                  color: "#758A6D",
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

     // 開始確認
if (userMessage === "ととのえ方分析") {
  const flex = buildDiagnosisConfirmFlex();
  return client.replyMessage(event.replyToken, flex); // ← ここ
}

if (userMessage === "ととのい度チェック") {
  const flex = buildFollowupConfirmFlex();
  return client.replyMessage(event.replyToken, flex); // ← ここ
}

      // 身近な人に紹介
      if (userMessage === "身近な人への紹介") {
        const shareUrl = "https://lin.ee/UxWfJtV";
        await client.replyMessage(event.replyToken, [
          {
            type: "text",
            text: "ご紹介ありがとうございます✨\n👇こちら紹介文のコピペ用テンプレート文です。ぜひ参考にお使いください！😊",
          },
          {
            type: "text",
            text:
              "最近、自分の不調の根本原因の体質バランスとケア方法を分析してくれるLINEツールを見つけて、\n参考になりそうだからシェアするね！",
          },
          {
            type: "text",
            text: `🔗 LINE登録はこちら\n${shareUrl}`,
          },
        ]);
        return;
      }

      // トライアル開始完了
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
            text: "🎁ありがとうございます！16日間の無料トライアルがスタートしました！\n\n⏰定期的なリマインドで、習慣改善やセルフケアを継続サポートしていきますね😊\n\n📊 さらに、AIと一緒に「体調変化」や「ととのうケアガイド実施状況」をみる『定期チェックナビ』(メニューボタン)の週1回利用をオススメしています！\n推奨タイミングで「促しリマインド」を入れるので、ぜひ活用してくださいね💪\n\nまた、ケアに関する疑問や生活上のお困りごとなど、どんなことでも『チャット相談メニュー』ボタンからトトノウAI（GPT）やプロ（鍼灸師）にお気軽にご相談いただけるのでぜひご活用を！🧑‍⚕️",
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

// server.js のイベント処理内に以下を追加
const { buildChatConsultOptionsFlex } = require("./utils/flexBuilder");

if (userMessage === "チャット相談") {
  const flex = buildChatConsultOptionsFlex();
  await client.replyMessage(event.replyToken, flex);
  return;
}

      // プロに相談（ここで awaiting_consult_message: true をセット）
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
    if ((user.remaining_consultations || 0) <= 0) {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `ご相談回数の上限に達しています🙏\n\nスタンダード会員様は月ごとにリセットされます。\nもう一度ご相談されたい場合は、来月までお待ちいただくか、サポートまでご連絡ください。`,
      });
      return;
    }

    // 相談可能なので、awaiting_consult_message を true にセット
    await supabase
      .from("users")
      .update({ awaiting_consult_message: true })
      .eq("line_id", lineId);

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: `メッセージありがとうございます！\nご相談内容をこのトーク画面でご自由にお送りください☺️\n\n📝 残り相談回数：${user.remaining_consultations}回\n\n例：\n・最近の不調や気になる症状\n・セルフケアのやり方やコツ\n・漢方やツボの詳しい説明\n・診断結果についての質問　など`,
    });
  } else {
    const subscribeUrl = `https://totonoucare.com/subscribe/?line_id=${lineId}`;
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: `恐れ入りますが、この機能はスタンダード会員またはトライアル中の方限定となります🙏\n以下よりご登録いただくと、LINE相談がご利用可能になります✨\n\n🔗 ${subscribeUrl}`,
    });
  }
  return;
}

// 「ととのうGPTでAI相談」トリガー
// messageイベントかどうか＆textかどうかを事前にチェック
if (event.type === "message" && event.message.type === "text") {
  const userMessage = event.message.text;
  const replyToken = event.replyToken;
  const lineId = event.source.userId;

  // 「ととのうGPTでAI相談」トリガー
  if (userMessage === "ととのうGPTでAI相談") {
    // ユーザーデータを取得（UUID含む）
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, subscribed, plan_type, trial_intro_done")
      .eq("line_id", lineId)
      .single();

    if (userError || !userData) {
      await client.replyMessage(replyToken, {
        type: "text",
        text: "ユーザー情報の取得に失敗しました🙏\n一度メニューから診断を受け直してください。",
      });
      return;
    }

    const userId = userData.id;
    const isStandardSub = userData.subscribed && userData.plan_type === "standard";
    const isTrial = userData.trial_intro_done;

    // 会員条件チェック（スタンダードまたはトライアル）
    if (!isStandardSub && !isTrial) {
      const subscribeUrl = `https://totonoucare.com/subscribe/?line_id=${lineId}`;
      await client.replyMessage(replyToken, {
        type: "text",
        text: `恐れ入りますが、この機能はスタンダード会員またはトライアル中の方限定となります🙏\n以下よりご登録いただくと、ご利用可能になります✨\n\n🔗 ${subscribeUrl}`,
      });
      return;
    }

    // 最新の分析コードをcontextsから取得
    const { data: contextData, error: contextError } = await supabase
      .from("contexts")
      .select("code")
      .eq("user_id", userId) // ← UUIDで照合
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const code = contextData?.code || "コード未登録";

    // メッセージ送信
    const messages = [
      {
        type: "text",
        text: "✅ ととのうGPTでのAI相談がご利用いただけます！\n分析コードをGPTに伝えると、あなたに合ったセルフケアアドバイスを受けられます✨",
      },
      {
        type: "text",
        text: `🧠 最新の分析結果コード：${code}`,
      },
      {
        type: "text",
        text: "👇 以下のリンクからAI相談を開始できます\nhttps://chatgpt.com/g/g-68923563b29c8191acd3bf82435a3bed-totonoukeanahi-tiyatutoxiang-tan-ai",
      },
    ];

    await client.replyMessage(replyToken, messages);
    return;
  }
}

      // 定期チェックナビ
if (userMessage === "ととのい度チェック開始" || handleFollowup.hasSession?.(lineId)) {
  try {
    const messages = await handleFollowup(event, client, lineId);

    if (messages === null) {
      // 未登録または未サブスクユーザーなど ⇒ メッセージ送信済みなので return だけ
      return;
    }

    if (Array.isArray(messages) && messages.length > 0) {
      await client.replyMessage(event.replyToken, messages);
    } else if (!handleFollowup.hasSession(lineId)) {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "ととのい度チェックを始めるには、メニューバーの【定期チェックナビ】をタップしてください。",
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

      // ととのえ方分析開始
      if (userMessage === "ととのえ方分析開始") {
        diagnosis.startSession(lineId);
        const flex = buildCategorySelectionFlex();
        await client.replyMessage(event.replyToken, flex);
        return;
      }

      // 分析セッション中
      if (diagnosis.hasSession(lineId)) {
        const result = await diagnosis.handleDiagnosis(lineId, userMessage, event);
        if (result.sessionUpdate) result.sessionUpdate(userMessage);
        await client.replyMessage(event.replyToken, result.messages);
        return;
      }

// 分析以外のコマンド（ととのうケアガイドなど）
const extraResult = await diagnosis.handleExtraCommands(lineId, userMessage);
if (extraResult && extraResult.messages) {
  await client.replyMessage(event.replyToken, extraResult.messages);
  return;
}

// 👤 awaiting_consult_message: true のユーザーのみ処理（多重発火防止）
const { data: consultUser, error: consultError } = await supabase
  .from("users")
  .select("remaining_consultations")
  .eq("line_id", lineId)
  .eq("awaiting_consult_message", true)
  .single();

if (!consultError && consultUser) {
  const newCount = Math.max((consultUser.remaining_consultations || 0) - 1, 0);

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update({
      remaining_consultations: newCount,
      awaiting_consult_message: false,
    })
    .eq("line_id", lineId)
    .eq("awaiting_consult_message", true)
    .select(); // ← 更新の反映確認にも使える

  if (updateError) {
    console.error("❌ 相談カウント更新失敗:", updateError);
  } else if (updated?.length > 0) {
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: `ご相談ありがとうございます！\nスタッフが順次お返事いたしますね☺️\n\n📝 残り相談回数：${newCount}回`,
    });
  } else {
    console.warn("⚠️ awaiting_consult_message が false に戻っていた可能性：更新スキップ");
  }

  return;
}

      // デフォルト返信
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `メッセージありがとうございます😊\nお問い合わせ・不具合報告には24時間以内にご対応させていただきますね！`,
      });
    })
  );

  res.status(200).json(results);
});

// Stripe Webhook
app.use("/stripe/webhook", stripeWebhook);

// Stripe Checkout
app.use("/create-checkout-session", stripeCheckout);

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});

// ✅ 404対策として / にアクセスがあったときにOK返す（UptimeRobot用）
app.get('/', (req, res) => {
  res.send('TotonouBot is alive');
});

// ✅ それ以外の未定義ルートに対するカスタム404表示
app.use((req, res) => {
  res.status(404).send(`
    <html>
      <head><title>404 - Not Found</title></head>
      <body style="font-family:sans-serif; padding:2rem;">
        <h1>ページが見つかりませんでした</h1>
        <p>このURLには対応していません。</p>
        <a href="https://totonoucare.com">トップページへ戻る</a>
      </body>
    </html>
  `);
});
