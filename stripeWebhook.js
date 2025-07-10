// stripeWebhook.js
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { markSubscribed } = require("./supabaseMemoryManager");
const supabase = require("./supabaseClient"); // ← 追加：Supabase直アクセス用

const router = express.Router();

// Stripe Webhookのエンドポイント（生のbodyが必要）
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
          // ① Supabaseでsubscribedをtrueにする（既存）
          await markSubscribed(lineId);
          console.log(`✅ サブスク登録完了: ${lineId}`);

          // ② trial_intro_done を false に更新（追加）
          const { error: updateError } = await supabase
            .from("users")
            .update({ trial_intro_done: false })
            .eq("line_id", lineId);

          if (updateError) {
            console.error("⚠️ trial_intro_done 更新失敗:", updateError);
          } else {
            console.log(`🔄 trial_intro_done を false に更新: ${lineId}`);
          }

        } catch (err) {
          console.error("❌ Supabase更新処理エラー:", err);
          return res.status(500).send("Supabase update failed");
        }
        break;
      }

      case "invoice.paid": {
        // 継続課金成功イベント（必要に応じて）
        break;
      }

      default:
        console.log(`ℹ️ Stripe未処理イベント: ${event.type}`);
    }

    return res.status(200).send("Webhook received");
  }
);

module.exports = router;
