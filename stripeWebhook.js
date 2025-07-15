// stripeWebhook.js
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { markSubscribed, markUnsubscribed } = require("./supabaseMemoryManager");
const line = require("@line/bot-sdk");
const supabase = require("./supabaseClient");

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const router = express.Router();

// ✅ 修正ポイント：ルートを "/" に変更（server.jsと一致させるため）
router.post(
  "/",
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

          if (planType === "standard") {
            const { data: user, error } = await supabase
              .from("users")
              .select("id, remaining_chats")
              .eq("line_id", lineId)
              .maybeSingle();
            if (error || !user) throw error || new Error("ユーザーが見つかりません");

            const updatedCount = Math.min((user.remaining_chats || 0) + 5, 30);
            await supabase
              .from("users")
              .update({ remaining_chats: updatedCount })
              .eq("id", user.id);

            await client.pushMessage(lineId, {
              type: "text",
              text:
                "🎉 スタンダードコースのご登録ありがとうございます！✨\n\n" +
                "定期チェックナビ、4日に一度の応援リマインドに加え、\n" +
                "LINE相談が毎月5回までご利用いただけます✨\n" +
                "（※未使用分は最大30回まで自動繰り越しされます）\n\n" +
                "ととのうケアナビをぜひ継続して、気になる不調のケアにお役立てください！",
            });
          } else if (planType === "light") {
            await client.pushMessage(lineId, {
              type: "text",
              text:
                "🎉 ライトコースのご登録ありがとうございます！\n\n" +
                "定期チェックナビ（何度でも）、4日に一度の応援リマインドを毎月ご活用いただけます😊\n" +
                "ととのうケアナビをぜひ継続して、気になる不調のケアにお役立てください✨",
            });
          }

          console.log(`📩 LINE通知送信完了: ${lineId}`);
        } catch (err) {
          console.error("❌ Webhook処理エラー:", err);
          return res.status(500).send("Webhook内部処理中にエラーが発生しました");
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const priceId = subscription.items.data[0]?.price.id;

        const planType =
          priceId === "price_1RitWqEVOs4YPHrumBOdaMVJ"
            ? "standard"
            : priceId === "price_1RitG7EVOs4YPHruuPtlHrpV"
            ? "light"
            : null;

        try {
          const { data: user, error } = await supabase
            .from("users")
            .select("line_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();

          if (error || !user) {
            console.error("❌ plan変更対象ユーザーが見つかりません:", error);
            return res.status(404).send("User not found");
          }

          const lineId = user.line_id;

          await markSubscribed(lineId, {
            plan_type: planType,
            stripe_customer_id: customerId,
          });

          console.log(`✅ プラン変更に伴う更新完了: ${lineId}`);
        } catch (err) {
          console.error("❌ プラン変更処理エラー:", err);
          return res.status(500).send("プラン変更処理中にエラーが発生しました");
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        try {
          const { data: user, error } = await supabase
            .from("users")
            .select("line_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();

          if (error || !user) {
            console.error("❌ 解約対象ユーザーが見つかりません:", error);
            return res.status(404).send("User not found");
          }

          const lineId = user.line_id;

          await markUnsubscribed(lineId);

          await client.pushMessage(lineId, {
            type: "text",
            text:
              "📪 サブスクの解約手続きが完了しました。\n\n" +
              "またのご利用をお待ちしております😊",
          });

          console.log(`✅ 解約処理完了: ${lineId}`);
        } catch (err) {
          console.error("❌ 解約処理エラー:", err);
          return res.status(500).send("解約処理中にエラーが発生しました");
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
