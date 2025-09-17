// router/webPush.js
import express from "express";
import webpush from "web-push";
import PushSubscription from "../model/pushNotification.model.js";
import Employee from "../model/employee.model.js"; // ⚠️ adjust path if needed

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
  return PushSubscription.find({ userId }).lean(); // [{ endpoint, keys }]
};

const removeSubscriptionByEndpoint = async (endpoint) => {
  await PushSubscription.deleteOne({ endpoint });
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
  if (!subs.length)
    return res.json({ ok: true, count: 0, note: "no subscriptions found" });

  const payload = JSON.stringify({
    title: title || "Update",
    body: body || "",
    url: url || "/",
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      );
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await removeSubscriptionByEndpoint(sub.endpoint); // prune stale
      } else {
        console.error("Push error:", e.statusCode, e.body || e.message);
      }
    }
  }
  res.json({ ok: true, count: sent });
});

/**
 * POST /api/push/clockin
 * Body: { userId: "<actor Mongo _id>", name?: "Display Name", url?: "/Attendance" }
 * Behavior: notifies all *other* users that this person clocked in.
 */
function capitalizeFirstLetter(str) {
  return str[0].toUpperCase() + str.slice(1);
}
router.post("/clockin", async (req, res) => {
  try {
    const { userId, name, url, title } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });

    // Resolve a friendly name (prefer payload; fallback to Employee doc; else generic)
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

    // Target all subscriptions except the actor's
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

    let sent = 0;
    if (subs.length === 1) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
          {
            TTL: 600, // 10 min freshness
            urgency: "high", // this is time-sensitive
            topic: "clockin", // collapse key
          }
        );
        sent = 1;
      } catch (error) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await removeSubscriptionByEndpoint(sub.endpoint);
        } else {
          console.error(
            "Clock-in push error:",
            e.statusCode,
            e.body || e.message
          );
        }
      }
    }
    else{

    
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
          {
            TTL: 600, // 10 min freshness
            urgency: "high", // this is time-sensitive
            topic: "clockin", // collapse key
          }
        );
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await removeSubscriptionByEndpoint(sub.endpoint);
        } else {
          console.error(
            "Clock-in push error:",
            e.statusCode,
            e.body || e.message
          );
        }
      }
    }
  }

    return res.json({ ok: true, count: sent });
  } catch (e) {
    console.error("clockin route failed:", e);
    return res.status(500).json({ error: "Failed to broadcast clock-in" });
  }
});

export default router;
