// routes/stripeCheckout.js

const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ✅ HTMLフォームからの POST に対応（application/x-www-form-urlencoded）
router.use(express.urlencoded({ extended: true }));

// ✅ POST /create-checkout-session に対応するため、router.post('/') に修正
router.post('/', async (req, res) => {
  const { lineId, planType } = req.body;

  console.log("📩 リクエスト受信:", { lineId, planType });

  if (!lineId || !planType) {
    console.warn("⚠️ lineId または planType が不足しています");
    return res.status(400).send("lineId または planType が不足しています");
  }

  const priceIdMap = {
    standard: 'price_1RitWqEVOs4YPHrumBOdaMVJ', // ← スタンダード（月額980円）
    light: 'price_1RitG7EVOs4YPHruuPtlHrpV',    // ← ライト（月額580円）
  };

  const priceId = priceIdMap[planType];

  if (!priceId) {
    console.warn("⚠️ 無効なプランタイプ:", planType);
    return res.status(400).send("無効なプランタイプです");
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

    // ✅ フォーム送信時は redirect で返すのが自然
    return res.redirect(303, session.url);
  } catch (err) {
    console.error('❌ Checkoutセッション作成エラー:', {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).send("決済リンク作成に失敗しました");
  }
});

module.exports = router;
