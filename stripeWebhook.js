// stripeWebhook.js
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { markSubscribed } = require("./supabaseMemoryManager");
const line = require("@line/bot-sdk");

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const router = express.Router();

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
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (!lineId || !subscriptionId) {
          console.error("❌ 必須データが不足しています");
          return res.status(400).send("Missing lineId or subscriptionId");
        }

        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;

          const planType =
            priceId === "price_1RitWqEVOs4YPHrumBOdaMVJ"
              ? "standard"
              : priceId === "price_1RitG7EVOs4YPHruuPtlHrpV"
              ? "light"
              : null;

          await markSubscribed(lineId, {
            plan_type: planType,
            stripe_customer_id: customerId,
          });

          await client.pushMessage(lineId, {
            type: "text",
            text:
              "🎉 決済が完了しました！\n\n" +
              "これでサブスク機能が有効になりました✨\n\n" +
              "LINE診断や定期チェック診断、セルフケアサポートをご活用ください😊",
          });

          console.log(`📩 LINE通知送信完了: ${lineId}`);
        } catch (err) {
          console.error("❌ Webhook処理エラー:", err);
          return res.status(500).send("Webhook内部処理中にエラーが発生しました");
        }

        break;
      }

      case "invoice.paid": {
        // 今後の継続課金対応などに使用予定
        break;
      }

      default:
        console.log(`ℹ️ 未処理のイベントタイプ: ${event.type}`);
    }

    return res.status(200).send("Webhook received");
  }
);

module.exports = router;
