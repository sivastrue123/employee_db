// middleware/checkSubscription.js
import Employee from "../model/employee.model.js";
import PushSubscription from "../model/pushNotification.model.js";

export const checkSubscription = async (req, res, next) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const existingEmployee = await Employee.findOne({
      email,
      isDeleted: false,
      status: "active",
    }).lean();

    if (!existingEmployee) {
      return res.status(404).json({ exists: false, message: "No Access" });
    }

    // 🔍 Look up subscriptions for this employee
    const subs = await PushSubscription.find({
      userId: existingEmployee.employee_id.toString(),
    }).lean();

    // Attach to req for downstream handlers
    req.employee = existingEmployee;
    req.hasSubscription = subs.length > 0;

    return next();
  } catch (error) {
    console.error("Error in checkSubscription middleware:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
