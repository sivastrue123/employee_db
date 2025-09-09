// import express from "express";
// import webpush from "web-push";
// import PushSubscription from "../model/pushNotification.model.js";

// const router = express.Router();

// webpush.setVapidDetails(
//   "mailto:sivav2535@gmail.com",
//   process.env.VAPID_PUBLIC_KEY,
//   process.env.VAPID_PRIVATE_KEY
// );

// // === IMPLEMENTATIONS ===
// const saveSubscription = async ({ userId, subscription }) => {
//   await PushSubscription.findOneAndUpdate(
//     { endpoint: subscription.endpoint },
//     { userId, endpoint: subscription.endpoint, keys: subscription.keys },
//     { upsert: true, new: true, setDefaultsOnInsert: true }
//   );
// };

// const findSubscriptionsByUser = async (userId) => {
//   return PushSubscription.find({ userId }).lean(); // [{ endpoint, keys }]
// };

// const removeSubscriptionByEndpoint = async (endpoint) => {
//   await PushSubscription.deleteOne({ endpoint });
// };

// // === ROUTES (unchanged) ===
// router.post("/subscribe", async (req, res) => {
//   try {
//     const { userId, subscription } = req.body || {};
//     if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh) {
//       return res.status(400).json({ error: "Invalid payload" });
//     }
//     await saveSubscription({ userId, subscription });
//     res.status(201).json({ ok: true });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Failed to save subscription" });
//   }
// });

// router.post("/send", async (req, res) => {
//   const { userId, title, body, url } = req.body || {};
//   if (!userId) return res.status(400).json({ error: "userId required" });

//   const subs = await findSubscriptionsByUser(userId);
//   if (!subs.length)
//     return res.json({ ok: true, count: 0, note: "no subscriptions found" });

//   const payload = JSON.stringify({
//     title: title || "Update",
//     body: body || "",
//     url: url || "/",
//   });

//   let sent = 0;
//   for (const sub of subs) {
//     try {
//       await webpush.sendNotification(
//         { endpoint: sub.endpoint, keys: sub.keys },
//         payload
//       );
//       sent++;
//     } catch (e) {
//       if (e.statusCode === 404 || e.statusCode === 410) {
//         await removeSubscriptionByEndpoint(sub.endpoint); // prune stale
//       } else {
//         console.error("Push error:", e.statusCode, e.body || e.message);
//       }
//     }
//   }
//   res.json({ ok: true, count: sent });
// });

// export default router;
