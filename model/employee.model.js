import mongoose from "mongoose";

const DEPARTMENTS = [
  "Development",
  "Support",
  "AI",
  "Sales",
  "Management",
  "API",
];
const STATUS_OPTIONS = ["active", "inactive", "terminated"];

const employeeSchema = new mongoose.Schema(
  {
    employee_id: {
      type: String,
      unique: true,
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
      minlength: [1, "Last name must be at least 1 characters long"],
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
    isDeleted: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ["admin", "employee"],
      default: "employee",
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

const Employee = mongoose.model("Employee", employeeSchema);
export default Employee;
