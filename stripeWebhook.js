// stripeWebhook.js
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { markSubscribed } = require("./supabaseMemoryManager");
const supabase = require("./supabaseClient"); // ← Supabase直アクセス用
const line = require("@line/bot-sdk"); // ✅ LINE通知用

// LINEクライアント初期化
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const router = express.Router();

// JST現在時刻（ISO文字列）を取得
function getJSTISOStringNow() {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jstNow.toISOString();
}

router.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Stripe署名検証エラー:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const lineId = session.client_reference_id;

        if (!lineId) {
          console.error("❌ client_reference_idが存在しません");
          return res.status(400).send("Missing client_reference_id");
        }

        try {
          // ① Supabaseでsubscribedをtrueにする
          await markSubscribed(lineId);
          console.log(`✅ サブスク登録完了: ${lineId}`);

          // ② trial_intro_done を false に、trial_ended_at を現在JSTに更新
          const { error: updateError } = await supabase
            .from("users")
            .update({
              trial_intro_done: false,
              trial_ended_at: getJSTISOStringNow(),
            })
            .eq("line_id", lineId);

          if (updateError) {
            console.error("⚠️ trial_intro_done / trial_ended_at 更新失敗:", updateError);
          } else {
            console.log(`🔄 trial_intro_done: false & trial_ended_at 記録: ${lineId}`);
          }

          // ③ LINE通知を送信
          await client.pushMessage(lineId, {
            type: "text",
            text:
              "🎉 決済が完了しました！\n\n" +
              "これでサブスク機能が有効になりました✨\n\n" +
              "LINE診断や定期チェック診断、セルフケアサポートをご活用ください😊",
          });
          console.log(`📩 LINE通知送信完了: ${lineId}`);
        } catch (err) {
          console.error("❌ SupabaseまたはLINE通知処理エラー:", err);
          return res.status(500).send("Webhook処理中にエラーが発生しました");
        }
        break;
      }

      case "invoice.paid": {
        // 今後、継続課金の確認用に実装予定
        break;
      }

      default:
        console.log(`ℹ️ Stripe未処理イベント: ${event.type}`);
    }

    return res.status(200).send("Webhook received");
  }
);

module.exports = router;
