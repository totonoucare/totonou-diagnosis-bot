const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// 💡 フロントから lineId と planType を受け取って決済リンク生成
router.post('/create-checkout-session', async (req, res) => {
  const { lineId, planType } = req.body;

  if (!lineId || !planType) {
    return res.status(400).json({ error: 'lineId または planType が不足しています' });
  }

  try {
    const priceId =
      planType === 'standard'
        ? 'price_1RitWqEVOs4YPHrumBOdaMVJ' // ←スタンダード980円（Stripeのprice IDに置き換えて）
        : 'price_1RitG7EVOs4YPHruuPtlHrpV'; // ←ライト580円（Stripeのprice IDに置き換えて）

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: lineId, // 👈 ここがWebhookで照合するキー
      success_url: 'https://totonoucare.com/success',
      cancel_url: 'https://totonoucare.com/cancel',
    });

    console.log("✅ Checkoutセッション作成:", session.id);
    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Checkoutセッション作成エラー:', err);
    res.status(500).json({ error: 'Stripeセッション作成に失敗しました' });
  }
});

module.exports = router;
