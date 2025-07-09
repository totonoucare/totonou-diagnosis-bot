const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const supabase = require("./supabaseClient");

const router = express.Router();

router.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // イベントタイプごとの処理
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const lineId = session.client_reference_id;

    const { error } = await supabase
      .from("users")
      .update({
        subscribed: true,
        subscribed_at: new Date().toISOString(),
      })
      .eq("line_id", lineId);

    if (error) {
      console.error("❌ Supabase更新失敗:", error);
      return res.status(500).send("Database update failed");
    }

    console.log("✅ Supabase updated for line_id:", lineId);
  }

  res.status(200).send("Webhook received");
});

module.exports = router;
