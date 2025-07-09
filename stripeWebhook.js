// stripeWebhook.js
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { markSubscribed } = require("./supabaseMemoryManager");

const router = express.Router();

// Stripe Webhookのエンドポイント（生のbodyが必要）
router.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
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

  // ✅ checkout完了イベント
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const lineId = session.client_reference_id;

    if (!lineId) {
      console.error("❌ client_reference_idが存在しません");
      return res.status(400).send("Missing client_reference_id");
    }

    try {
      await markSubscribed(lineId);
      console.log(`✅ サブスク登録完了: ${lineId}`);
    } catch (err) {
      console.error("❌ markSubscribed実行エラー:", err);
      return res.status(500).send("Supabase update failed");
    }
  }

  // 他イベントは受け取るが何もせず成功応答
  return res.status(200).send("Webhook received");
});

module.exports = router;
