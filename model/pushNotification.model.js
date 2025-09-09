import mongoose from "mongoose";

const KeySchema = new mongoose.Schema(
  {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  { _id: false }
);

const PushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true, required: true },
    endpoint: { type: String, unique: true, required: true },
    keys: { type: KeySchema, required: true },
  },
  { timestamps: true }
);

const PushSubscription = mongoose.model(
  "PushSubscription",
  PushSubscriptionSchema
);
export default PushSubscription;
