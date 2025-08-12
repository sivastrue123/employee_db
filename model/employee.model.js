import mongoose from "mongoose";

// --- Counter Schema ---
const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});
const Counter = mongoose.model("Counter", counterSchema);

// --- Constants ---
const DEPARTMENTS = [
  "Engineering",
  "Marketing",
  "Sales",
  "HR",
  "Finance",
  "Operations",
  "Design",
];
const STATUS_OPTIONS = ["active", "inactive", "terminated"];

// --- Employee Schema ---
const employeeSchema = new mongoose.Schema(
  {
    employee_id: {
      type: String,
      unique: true, // Ensure the ID is unique
    },
    first_name: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must be at least 2 characters long"],
    },
    last_name: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [2, "Last name must be at least 2 characters long"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please fill a valid email address",
      ],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid 10-digit phone number!`,
      },
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
      enum: {
        values: DEPARTMENTS,
        message: `Department must be one of: ${DEPARTMENTS.join(", ")}`,
      },
    },
    position: {
      type: String,
      required: [true, "Position is required"],
      trim: true,
    },
    hire_date: {
      type: Date,
      required: [true, "Hire date is required"],
    },
    hourly_rate: {
      type: Number,
      required: [true, "Hourly rate is required"],
      min: [0, "Hourly rate cannot be negative"],
    },
    profile_image: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      trim: true,
      lowercase: true,
      enum: {
        values: STATUS_OPTIONS,
        message: `Status must be one of: ${STATUS_OPTIONS.join(", ")}`,
      },
    },
  },
  {
    timestamps: true,
  }
);

// --- Pre-save hook to auto-increment the employee_id ---
employeeSchema.pre("save", async function (next) {
  // Only generate a new ID if it's a new document
  if (this.isNew) {
    try {
      // Find and update the counter for "employeeid"
      const counter = await Counter.findByIdAndUpdate(
        { _id: "employeeid" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true } // Creates the counter if it doesn't exist
      );

      // Pad the sequence number with leading zeros to create the format "emp0001"
      const paddedId = String(counter.seq).padStart(4, "0");
      this.employee_id = `emp${paddedId}`;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

const Employee = mongoose.model("Employee", employeeSchema);
export default Employee;