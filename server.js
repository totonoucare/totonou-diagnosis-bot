// =====================================
// 🚀 server.js（最終形）
// =====================================

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
  buildTotonouConsultExamplesFlex,
} = require("./utils/flexBuilder");
const stripeWebhook = require("./stripeWebhook");
const stripeCheckout = require("./routes/stripeCheckout");

// =====================================
// 🧠 Supabase Memory キャッシュ初期化（最新版対応）
// =====================================
const { LRUCache } = require("lru-cache");
const supabaseMemoryManager = require("./supabaseMemoryManager");

// Contextキャッシュを1時間保持（最大100ユーザー）
const ctxCache = new LRUCache({
  max: 100,                  // 最大100ユーザー分キャッシュ
  ttl: 1000 * 60 * 60,       // 1時間で期限切れ（必要なら6時間などに変更可）
});

// キャッシュを supabaseMemoryManager に登録
supabaseMemoryManager.setContextCacheRef(ctxCache);

// =====================================
// 他モジュールの読み込み
// =====================================

// ★ AI相談 本体（常時オンで呼び出す）
const consult = require("./consult/index");

// 実施記録ハンドラ
const handleCarelog = require("./carelog/index");

// =====================================
// Express アプリ設定
// =====================================
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

      // ===== 強トリガー系（先にすべて処理して return） =====

      // サービス案内（Flex）
      if (userMessage === "サービス案内") {
        const subscribeUrl = `https://totonoucare.com/subscribe/?line_id=${lineId}`;
        const flex = {
          type: "flex",
          altText: "サービス案内",
          contents: {
            type: "bubble",
            size: "mega",
            header: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "🔗 サービス案内リンク",
                  weight: "bold",
                  size: "lg",
                  color: "#ffffff"
                }
              ],
              backgroundColor: "#7B9E76",
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
                  color: "#7B9E76",
                  action: {
                    type: "uri",
                    label: "🔐 サブスク登録 / 解約ページ",
                    uri: subscribeUrl
                  }
                },
                {
                  type: "button",
                  style: "primary",
                  color: "#7B9E76",
                  action: {
                    type: "uri",
                    label: "対面サービス予約サイト",
                    uri: subscribeUrl
                  }
                },
                {
                  type: "button",
                  style: "primary",
                  color: "#7B9E76",
                  action: {
                    type: "uri",
                    label: "🌐 ご利用の流れ",
                    uri: "https://totonoucare.com/#flow"
                  }
                },
                {
                  type: "button",
                  style: "primary",
                  color: "#7B9E76",
                  action: {
                    type: "message",
                    label: "✉️ 身近な人へのご紹介",
                    text: "身近な人への紹介"
                  }
                },
              ]
            }
          }
        };
        await client.replyMessage(event.replyToken, flex);
        return;
      }

      // 開始確認（分析／フォローアップ）
      if (userMessage === "ととのえタイプ分析") {
        const flex = buildDiagnosisConfirmFlex();
        return client.replyMessage(event.replyToken, flex);
      }
      if (userMessage === "ととのい度チェック") {
        const flex = buildFollowupConfirmFlex();
        return client.replyMessage(event.replyToken, flex);
      }

      // 身近な人に紹介
      if (userMessage === "身近な人への紹介") {
        const shareUrl = "https://page.line.me/173moafk";
        await client.replyMessage(event.replyToken, [
          {
            type: "text",
            text: "ありがとうございます✨\n👇こちらのリンクをコピペしてご紹介ください！😊",
          },
          {
            type: "text",
            text: `体質タイプ分析もセルフケアサポートも健康相談も、すべてLINEひとつで。🔗 公式LINE登録はこちら\n${shareUrl}`,
          },
        ]);
        return;
      }

      // トライアル開始完了（postback）
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
            text: "🎁ありがとうございます！16日間の無料体験期間がスタートしました！\n\n☑️完了したケアがあればいつでもメニュー内ボタンでトトノウくんに報告してくださいね😎 \nまた、体調変化をチェックする『ととのい度チェック』のご利用タイミングはリマインドメッセージでこちらからもお知らせします！🕊️(メニューボタンでも開始可能です)\n\nトトノウくんへの質問はトークからお気軽にどうぞ！🧠\nメニューにも「トトノウくんに質問」ボタンにおすすめ質問集をご用意！さっそく質問してみてくださいね！(応答に少し時間がかかることがあります。）",
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

      // チャット相談メニュー（既存UIを残すだけ／AIとは別物）
      if (userMessage === "チャット相談") {
        const flex = buildChatConsultOptionsFlex();
        await client.replyMessage(event.replyToken, flex);
        return;
      }

      // トトノウ相談（AIへの質問例Flex）
      if (userMessage === "トトノウくんに相談") {
        const flex = buildTotonouConsultExamplesFlex();
        await client.replyMessage(event.replyToken, flex);
        return;
      }

      // 人に相談（awaiting_consult_message: true にして以降はAIを反応させない）
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
              text: `ご相談回数の上限に達しています🙏\n\nサブスク利用ユーザー様は月ごとにリセットされます。\nもう一度ご相談されたい場合は、来月までお待ちいただくか、サポートまでご連絡ください。`,
            });
            return;
          }

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

      // 外部GPTリンク案内（既存）
      if (event.type === "message" && event.message.type === "text") {
        const userMessageIn = event.message.text;
        const replyToken = event.replyToken;
        const lineIdIn = event.source.userId;

        if (userMessageIn === "ととのうGPTでAI相談") {
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("id, subscribed, plan_type, trial_intro_done")
            .eq("line_id", lineIdIn)
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

          if (!isStandardSub && !isTrial) {
            const subscribeUrl = `https://totonoucare.com/subscribe/?line_id=${lineIdIn}`;
            await client.replyMessage(replyToken, {
              type: "text",
              text: `恐れ入りますが、この機能はサブスク利用ユーザー様またはトライアル中のユーザー様限定となります🙏\n以下よりご登録いただくと、ご利用可能になります✨\n\n🔗 ${subscribeUrl}`,
            });
            return;
          }

          const { data: contextData } = await supabase
            .from("contexts")
            .select("code")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const code = contextData?.code || "コード未登録";

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

      // ===== ととのい度チェック（強トリガー）— フロー専用。GPTは反応させない =====
      if (userMessage === "ととのい度チェック開始" || handleFollowup.hasSession?.(lineId)) {
        try {
          const messages = await handleFollowup(event, client, lineId);

          if (messages === null) {
            return;
          }

          if (Array.isArray(messages) && messages.length > 0) {
            await client.replyMessage(event.replyToken, messages);
          } else if (!handleFollowup.hasSession(lineId)) {
            await client.replyMessage(event.replyToken, {
              type: "text",
              text: "ととのい度チェックを始めるには、メニューの【ととのい度チェック】ボタンをタップしてください。",
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

      // ===== ととのえ方分析（強トリガー）— フロー専用。GPTは反応させない =====
      if (userMessage === "ととのえタイプ分析開始") {
        diagnosis.startSession(lineId);
        const flex = buildCategorySelectionFlex();
        await client.replyMessage(event.replyToken, flex);
        return;
      }

      // 分析セッション中（GPTは反応させない）
      if (diagnosis.hasSession(lineId)) {
        const result = await diagnosis.handleDiagnosis(lineId, userMessage, event);
        if (result.sessionUpdate) result.sessionUpdate(userMessage);
        await client.replyMessage(event.replyToken, result.messages);
        return;
      }

      // 分析以外のコマンド（ととのうケアガイド等）
      const extraResult = await diagnosis.handleExtraCommands(lineId, userMessage);
      if (extraResult && extraResult.messages) {
        await client.replyMessage(event.replyToken, extraResult.messages);
        return;
      }

      // 人相談中は GPT に投げない（awaiting_consult_message: true）
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
          .select();

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

      // ===== 実施記録ハンドラ（実施ボタン / ケア完了） =====
const handledCare = await handleCarelog(event, client, lineId, userMessage);
if (handledCare) return;

// === どの条件にも該当しなかった場合はAI相談へ ===
if (event.type === "message" && event.message.type === "text") {
  await consult(event, client); // consult/index.js 側でフォールバック処理済み
  return;
}

      // デフォルト返信（基本到達しない想定）
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
