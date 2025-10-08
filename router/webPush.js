// routes/push.router.js
import express from "express";
import { MongoClient, ObjectId } from "mongodb"; // Import MongoClient and ObjectId
import webpush from "web-push";
import { MongoClient } from "mongodb";
import Employee from "../model/employee.model.js"; // retained for /clockin
import { URI, DATABASE_NAME, PUBLIC_KEY, PRIVATE_KEY } from "../config.js";

// -----------------------------
// Guardrails / Config hygiene
// -----------------------------
if (!URI || !DATABASE_NAME) {
  // Fail fast in prod; don't boot a half-configured service
  throw new Error("FATAL: URI and DATABASE_NAME must be defined in config.js");
}

if (!PUBLIC_KEY || !PRIVATE_KEY) {
  // Web Push mandates VAPID; missing keys = predictable 401/403 in prod
  throw new Error(
    "FATAL: PUBLIC_KEY and PRIVATE_KEY must be defined for web-push VAPID"
  );
}

// Your web-push setup remains the same
try {
  webpush.setVapidDetails(
    // Use a neutral mailbox; align with your domain for DMARC alignment if possible
    "mailto:sivav2535@gmail.com",
    `BFMSTQdSh9Dskh8lUvel5mntPdyDBu49UteVmNwkUf1nEpLEsBR40WSYktsVL9XVQNjV-yM79E1c26X53MkQcRQ`,
    `GH1AMaXAkfKnQQr07b-7USN5NTzO3CCOZeGaJN174g4`
  );
} catch (e) {
  // Fail loud — bad keys shouldn’t allow the app to start
  throw new Error(`FATAL: Failed to set VAPID details: ${e.message}`);
}

const router = express.Router();

// -----------------------------
// Mongo client: single instance
// -----------------------------
/**
 * Reuse one client across requests to avoid exhausting sockets in prod.
 * Also creates indexes once for idempotent schema hygiene.
 */
let _client;
let _db;
async function getDb() {
  if (_db) return _db;
  _client = new MongoClient(URI, {
    // Hardening for prod networks
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 20000,
  });
  await _client.connect();
  _db = _client.db(DATABASE_NAME);

  // One-time indexes (idempotent)
  const col = _db.collection("pushsubscriptions");
  await col.createIndex({ endpoint: 1 }, { unique: true });
  await col.createIndex({ userId: 1 });

  return _db;
}

// Helper to unwrap Mongo v4/v5 findOneAndUpdate result
const unwrap = (res) => res?.value ?? res;

// -----------------------------
// Data access
// -----------------------------
async function saveSubscription({ userId, subscription }) {
  const db = await getDb();
  const collection = db.collection("pushsubscriptions");
  const doc = {
    userId,
    endpoint: subscription.endpoint,
    // Store full keyset for fidelity; many providers require both keys
    keys: {
      p256dh: subscription?.keys?.p256dh,
      auth: subscription?.keys?.auth,
    },
    expirationTime: subscription?.expirationTime ?? null,
    updatedAt: new Date(),
  };

  const result = await collection.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      $set: doc,
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true, returnDocument: "after" }
  );
  return unwrap(result);
}

async function findSubscriptionsByUser(userId, isAttendance) {
  const db = await getDb();
  const collection = db.collection("pushsubscriptions");

  const query = !isAttendance ? { userId } : { userId: { $ne: userId } };
  return collection.find(query).toArray();
}

async function removeSubscriptionByEndpoint(endpoint) {
  const db = await getDb();
  const collection = db.collection("pushsubscriptions");
  await collection.deleteOne({ endpoint });
}

// -----------------------------
// Push transport
// -----------------------------
async function sendPushNotification(subscriptionLike, payload) {
  // Ensure we only send the shape the web-push lib expects
  const subscription = {
    endpoint: subscriptionLike.endpoint,
    keys: {
      p256dh: subscriptionLike?.keys?.p256dh,
      auth: subscriptionLike?.keys?.auth,
    },
    expirationTime: subscriptionLike?.expirationTime ?? null,
  };

  try {
    await webpush.sendNotification(subscription, payload, {
      TTL: 600,
      urgency: "high",
      topic: "clockin",
    });
    return { ok: true, endpoint: subscription.endpoint };
  } catch (e) {
    // Smart auto-healing for dead/invalid subs
    const code = e?.statusCode;
    if (code === 401 || code === 403 || code === 404 || code === 410) {
      // 401/403: VAPID/cred issue or client revoked; 404/410: gone
      await removeSubscriptionByEndpoint(subscription.endpoint).catch(() => {});
    }
    return {
      ok: false,
      endpoint: subscription.endpoint,
      statusCode: code,
      error: e?.body || e?.message || "unknown push error",
    };
  }
}

// -----------------------------
// Utilities
// -----------------------------
function capitalizeFirstLetter(str) {
  if (typeof str !== "string" || !str.length) return "";
  return str[0].toUpperCase() + str.slice(1);
}

function requireJson(req, res, next) {
  // Prevent subtle prod issues when body parsers are misconfigured
  const ctype = req.headers["content-type"] || "";
  if (!ctype.includes("application/json")) {
    // Not fatal, but strongly signal expected contract
    res.set("X-Warning", "Expected application/json content-type");
  }
  next();
}

router.use(requireJson);

// -----------------------------
// Routes
// -----------------------------
router.post("/subscribe", async (req, res) => {
  try {
    const { userId, subscription } = req.body || {};
    // Tight validation: both keys are required for most push services
    if (
      !userId ||
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return res.status(400).json({
        error:
          "Invalid payload: userId, endpoint, keys.p256dh, keys.auth are required",
      });
    }

    const saved = await saveSubscription({ userId, subscription });
    return res.status(201).json({ ok: true, subscription: saved });
  } catch (e) {
    console.error("subscribe failed:", e);
    return res.status(500).json({ error: "Failed to save subscription" });
  }
});

router.post("/send", async (req, res) => {
  try {
    const { userId, title, body, url } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });

    const subs = await findSubscriptionsByUser(userId, false);
    if (subs.length === 0) {
      return res.json({
        ok: true,
        sentCount: 0,
        note: "no subscriptions found",
      });
    }

    const payload = JSON.stringify({
      title: title || "Update",
      body: body || "",
      url: url || "/",
    });

    const results = await Promise.allSettled(
      subs.map((sub) => sendPushNotification(sub, payload))
    );

    const successes = results
      .filter((r) => r.status === "fulfilled" && r.value?.ok)
      .map((r) => r.value?.endpoint);
    const failures = results
      .filter((r) => r.status === "fulfilled" && !r.value?.ok)
      .map((r) => r.value);
    const rejections = results
      .filter((r) => r.status === "rejected")
      .map((r) => ({ ok: false, error: r.reason?.message || "rejected" }));

    return res.json({
      ok: true,
      sentCount: successes.length,
      failCount: failures.length + rejections.length,
      successes,
      failures,
      rejections,
    });
  } catch (e) {
    console.error("send failed:", e);
    return res.status(500).json({ error: "Failed to send notifications" });
  }
});

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
            emp.email ||
            null;
        }
      } catch (e) {
        console.warn("clockin: name lookup failed:", e?.message);
      }
    }
    actorName = actorName || "A teammate";

    const subs = await findSubscriptionsByUser(userId, true);
    if (subs.length === 0) {
      return res.json({ ok: true, count: 0, note: "no recipients found" });
    }

    const normalizedTitle = capitalizeFirstLetter(title || "Clock-In");
    const action = title ? title.toLowerCase() : "clocked in";

    const payload = JSON.stringify({
      title: normalizedTitle,
      body: `${actorName} just ${action}.`,
      url: url || "/Attendance",
    });

    const results = await Promise.allSettled(
      subs.map((s) => sendPushNotification(s, payload))
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value?.ok
    ).length;

    return res.json({ ok: true, sent });
  } catch (e) {
    console.error("clockin route failed:", e);
    return res
      .status(500)
      .json({ error: "Failed to broadcast clock-in", message: e.message });
  }
});

export default router;

// -----------------------------
// Optional: graceful shutdown hook (register in your server entrypoint)
// -----------------------------
// process.on("SIGTERM", async () => {
//   try { await _client?.close(); } finally { process.exit(0); }
// });
