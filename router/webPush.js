// router/webPush.js
import express from "express";
import webpush from "web-push";
import PushSubscription from "../model/pushNotification.model.js";
import Employee from "../model/employee.model.js";

const router = express.Router();

webpush.setVapidDetails(
  "mailto:vinoth.siva@ezofis.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// === IMPLEMENTATIONS ===
const saveSubscription = async ({ userId, subscription }) => {
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { userId, endpoint: subscription.endpoint, keys: subscription.keys },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const findSubscriptionsByUser = async (userId) => {
  return PushSubscription.find({ userId }).lean();
};

const removeSubscriptionByEndpoint = async (endpoint) => {
  await PushSubscription.deleteOne({ endpoint });
};

// --- New function to handle notification sending and error handling
const sendPushNotification = async (subscription, payload) => {
  try {
    await webpush.sendNotification(subscription, payload, {
      TTL: 600,
      urgency: "high",
      topic: "clockin",
    });
    return true; // Success
  } catch (e) {
    // VAPID key mismatch or other authentication issues
    if (e.statusCode === 401 || e.statusCode === 403) {
      console.error(
        `[PUSH ERROR] Unauthorized/Forbidden: Stale VAPID credentials for subscription. Deleting subscription.`,
        e.body || e.message,
        subscription.endpoint
      );
      await removeSubscriptionByEndpoint(subscription.endpoint);
    }
    // Subscription is no longer valid or has expired
    else if (e.statusCode === 404 || e.statusCode === 410) {
      console.warn(
        `[PUSH WARNING] Subscription Not Found/Gone: Endpoint no longer active. Deleting subscription.`,
        subscription.endpoint
      );
      await removeSubscriptionByEndpoint(subscription.endpoint);
    } else {
      // Catch-all for other errors
      console.error(`[PUSH ERROR] Unexpected error: ${e.statusCode}`, e.body || e.message);
    }
    return false; // Failure
  }
};

// === ROUTES ===
router.post("/subscribe", async (req, res) => {
  try {
    const { userId, subscription } = req.body || {};
    if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh) {
      return res.status(400).json({ error: "Invalid payload" });
    }
    await saveSubscription({ userId, subscription });
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

router.post("/send", async (req, res) => {
  const { userId, title, body, url } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId required" });

  const subs = await findSubscriptionsByUser(userId);
  if (!subs.length) {
    return res.json({ ok: true, count: 0, note: "no subscriptions found" });
  }

  const payload = JSON.stringify({
    title: title || "Update",
    body: body || "",
    url: url || "/",
  });

  const promises = subs.map(sub => sendPushNotification(sub, payload));
  await Promise.allSettled(promises);

  res.json({ ok: true });
});

/**
 * POST /api/push/clockin
 */
function capitalizeFirstLetter(str) {
  return str[0].toUpperCase() + str.slice(1);
}

router.post("/clockin", async (req, res) => {
  try {
    const { userId, name, url, title } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });

    let actorName = name;
    if (!actorName) {
      try {
        const emp = await Employee.findOne({ employee_id: userId })
          .select("name first_name last_name email")
          .lean();
        if (emp) {
          actorName =
            emp.name ||
            `${emp.first_name || ""} ${emp.last_name || ""}`.trim() ||
            emp.email;
        }
      } catch (e) {
        console.warn("clockin: name lookup failed", e?.message);
      }
    }
    actorName = actorName || "A teammate";

    const subs = await PushSubscription.find({
      userId: { $ne: userId },
    }).lean();
    if (!subs.length) {
      return res.json({ ok: true, count: 0, note: "no recipients found" });
    }

    const payload = JSON.stringify({
      title: capitalizeFirstLetter(title) || "Clock-In",
      body: `${actorName} just ${title ? title.toLowerCase() : "clocked in"}.`,
      url: url || "/Attendance",
    });

    const promises = subs.map(sub => sendPushNotification(sub, payload));
    await Promise.allSettled(promises);

    return res.json({ ok: true });
  } catch (e) {
    console.error("clockin route failed:", e);
    return res
      .status(500)
      .json({ error: "Failed to broadcast clock-in", message: e });
  }
});

export default router;