const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ✅ JSONまたはフォームのPOST両方に対応
router.use(express.urlencoded({ extended: true }));
router.use(express.json()); // fetch()対応

// 💳 Stripe Checkoutセッション作成エンドポイント
router.post('/create-checkout-session', async (req, res) => {
  const { lineId, planType } = req.body;

  console.log("📩 リクエスト受信:", { lineId, planType });

  if (!lineId || !planType) {
    console.warn("⚠️ lineId または planType が不足しています");
    return res.status(400).json({ error: "lineId または planType が不足しています" });
  }

  const priceIdMap = {
    standard: 'price_1RitWqEVOs4YPHrumBOdaMVJ', // ← スタンダード（月額980円）
    light: 'price_1RitG7EVOs4YPHruuPtlHrpV',    // ← ライト（月額580円）
  };

  const priceId = priceIdMap[planType];

  if (!priceId) {
    return res.status(400).json({ error: "無効なプランタイプです" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: lineId,
      success_url: 'https://totonoucare.com/success',
      cancel_url: 'https://totonoucare.com/cancel',
    });

    console.log("✅ Checkoutセッション作成成功:", session.id);

    // ✅ JSON形式で決済URLを返す
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('❌ Checkoutセッション作成エラー:', {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "決済リンク作成に失敗しました" });
  }
});

module.exports = router;
