// stripeWebhook.js
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { markSubscribed } = require("./supabaseMemoryManager");

const router = express.Router();

// Stripe Webhookのエンドポイント（生のbodyが必要）
router.post(
  "/webhook/stripe", // ← URLはこの形に合わせる
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    // --- Stripe署名の検証 ---
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

    // --- ログ出力（デバッグ時のみ有効化）---
    // console.log("📩 Stripeイベント受信:", event.type);

    // --- イベントごとの処理 ---
    switch (event.type) {
      case "checkout.session.completed": {
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
        break;
      }

      case "invoice.paid": {
        // ✅ 将来、継続課金の確認などが必要になればここで処理
        // const invoice = event.data.object;
        // console.log("💰 継続課金が成功しました:", invoice.id);
        break;
      }

      default:
        // 未対応のイベントはログだけ出す
        console.log(`ℹ️ Stripe未処理イベント: ${event.type}`);
    }

    return res.status(200).send("Webhook received");
  }
);

module.exports = router;
