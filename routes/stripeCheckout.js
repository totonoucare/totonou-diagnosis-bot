const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// 💡 フロントから lineId と planType を受け取って決済リンク生成
router.post('/create-checkout-session', async (req, res) => {
  const { lineId, planType } = req.body;

  console.log("📩 リクエスト受信:", { lineId, planType });

  if (!lineId || !planType) {
    console.warn("⚠️ lineId または planType が不足しています");
    return res.status(400).json({ error: 'lineId または planType が不足しています' });
  }

  try {
    const priceId =
      planType === 'standard'
        ? 'price_1RitWqEVOs4YPHrumBOdaMVJ' // ←スタンダード980円
        : 'price_1RitG7EVOs4YPHruuPtlHrpV'; // ←ライト580円

    console.log("💳 使用する priceId:", priceId);

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
    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Checkoutセッション作成エラー:', {
      message: err.message,
      stack: err.stack,
      raw: err,
    });
    res.status(500).json({ error: 'Stripeセッション作成に失敗しました' });
  }
});

module.exports = router;
