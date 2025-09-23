import express from "express";
import webpush from "web-push";
import { MongoClient } from "mongodb";
import Employee from "../model/employee.model.js"; // Kept for the /clockin route
import { URI, DATABASE_NAME, PUBLIC_KEY, PRIVATE_KEY } from "../config.js";

const router = express.Router();

if (!URI || !DATABASE_NAME) {
  console.error("FATAL ERROR: URI and DATABASE_NAME must be defined in config.js");
  // This would ideally stop the server from starting
}

try {
  webpush.setVapidDetails(
    "mailto:vinoth.siva@ezofis.com",
    PUBLIC_KEY,
    PRIVATE_KEY
  );
} catch (e) {
  console.error("Failed to set VAPID details:", e.message);
}

// === IMPLEMENTATIONS (Using Native MongoDB Driver) ===

const connectAndOperate = async (operation) => {
  const client = new MongoClient(URI);
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    return await operation(db);
  } finally {
    await client.close();
  }
};

const saveSubscription = async ({ userId, subscription }) => {
  return connectAndOperate(async (db) => {
    const collection = db.collection("pushsubscriptions");
    const query = { endpoint: subscription.endpoint };
    const update = {
      $set: {
        userId,
        keys: subscription.keys,
        endpoint: subscription.endpoint,
      },
      $setOnInsert: { createdAt: new Date() }
    };
    const options = { upsert: true, returnDocument: 'after' };
    return await collection.findOneAndUpdate(query, update, options);
  });
};

const findSubscriptionsByUser = async (userId) => {
  return connectAndOperate(async (db) => {
    const collection = db.collection("pushsubscriptions");
    return await collection.find({ userId }).toArray();
  });
};

const removeSubscriptionByEndpoint = async (endpoint) => {
  return connectAndOperate(async (db) => {
    const collection = db.collection("pushsubscriptions");
    return await collection.deleteOne({ endpoint });
  });
};

const sendPushNotification = async (subscription, payload) => {
  try {
    await webpush.sendNotification(subscription, payload, {
      TTL: 600,
      urgency: "high",
      topic: "clockin",
    });
    return true; // Success
  } catch (e) {
    if (e.statusCode === 401 || e.statusCode === 403) {
      console.error(
        `[PUSH ERROR] Unauthorized/Forbidden. Deleting subscription.`,
        e.body || e.message
      );
      await removeSubscriptionByEndpoint(subscription.endpoint);
    } else if (e.statusCode === 404 || e.statusCode === 410) {
      console.warn(
        `[PUSH WARNING] Subscription Not Found/Gone. Deleting subscription.`,
        subscription.endpoint
      );
      await removeSubscriptionByEndpoint(subscription.endpoint);
    } else {
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
    const savedSubscription = await saveSubscription({ userId, subscription });
    if (!savedSubscription) {
        throw new Error("Failed to save subscription");
    }
    res.status(201).json({ ok: true, subscription: savedSubscription });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

router.post("/send", async (req, res) => {
  try {
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

    res.json({ ok: true, sentCount: subs.length });
  } catch (e) {
    console.error("Send notification route failed:", e);
    res.status(500).json({ error: "Failed to send notifications" });
  }
});

function capitalizeFirstLetter(str) {
  try {
    if (!str) return "";
    return str[0].toUpperCase() + str.slice(1);
  } catch (e) {
    console.error("Capitalize function failed:", e);
    return str;
  }
}

router.post("/clockin", async (req, res) => {
  try {
    const { userId, name, url, title } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });

    let actorName = name;
    if (!actorName) {
      try {
        // This part still uses the Mongoose Employee model as requested
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

    const subs = await findSubscriptionsByUser(userId);
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
      .json({ error: "Failed to broadcast clock-in", message: e.message });
  }
});

export default router;

