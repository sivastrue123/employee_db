// router/webPush.js
import express from "express";
import { MongoClient, ObjectId } from "mongodb"; // Import MongoClient and ObjectId
import webpush from "web-push";
// Models are not used here as we are using the native driver directly
// import PushSubscription from "../model/pushNotification.model.js";
// import Employee from "../model/employee.model.js";

const router = express.Router();

// Your web-push setup remains the same
try {
  webpush.setVapidDetails(
    "mailto:vinoth.siva@ezofis.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} catch (e) {
  console.error("Failed to set VAPID details:", e.message);
}

// === NEW /subscribe ROUTE FOR DEBUGGING ===

router.post("/subscribe", async (req, res) => {
  // Get the MongoDB connection string from environment variables
  const uri = process.env.MONGO_URI;
  if (!uri) {
    return res.status(500).json({ 
      error: "MongoDB URI not found in environment variables (MONGO_URI)." 
    });
  }

  // Initialize the client
  const client = new MongoClient(uri);
  
  try {
    const { userId, subscription } = req.body || {};
    if (!userId || !subscription?.endpoint) {
      return res.status(400).json({ error: "Invalid payload" });
    }
    
    // 1. Connect to the database
    await client.connect();
    console.log("✅ (Debug) Successfully connected to MongoDB for this request.");

    // 2. Define the DB and Collection
    // The db name is parsed from the URI, or you can specify it
    const db ="employee_db" // Uses the database from the URI
    const collection = db.collection("pushsubscriptions"); // Mongoose default collection name

    // 3. Prepare the document for upsert
    const query = { endpoint: subscription.endpoint };
    const update = {
      $set: {
        userId,
        keys: subscription.keys,
        endpoint: subscription.endpoint,
        createdAt: new Date(), // Good practice to add a timestamp
      },
    };
    const options = { upsert: true, returnDocument: 'after' };

    // 4. Perform the operation
    const result = await collection.findOneAndUpdate(query, update, options);
    
    // 5. Prepare the response with connection details for confirmation
    const dbName = db.databaseName;
    const dbHost = new URL(uri).hostname; // Extracts the host from the URI

    if (result) {
        res.status(201).json({
          ok: true,
          message: "Subscription saved successfully.",
          // The data that was saved or updated
          savedData: result,
          // --- DEBUGGING INFO ---
          debugInfo: {
            databaseHost: dbHost,
            databaseName: dbName,
            collectionName: "pushsubscriptions",
          }
        });
    } else {
        throw new Error("findOneAndUpdate did not return a document.");
    }

  } catch (e) {
    console.error("Error in /subscribe route:", e);
    res.status(500).json({ 
      error: "Failed to save subscription.", 
      message: e.message 
    });
  } finally {
    // 6. VERY IMPORTANT: Close the connection
    await client.close();
    console.log("🔒 (Debug) MongoDB connection closed for this request.");
  }
});


// ... your other routes (/send, /clockin) would also need to be modified
// in a similar fashion, which is why this approach is not recommended.

export default router;