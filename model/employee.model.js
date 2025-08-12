import mongoose from "mongoose";

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

const employeeSchema = new mongoose.Schema(
  {
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
      unique: true, // Ensures email is unique in the collection
      trim: true,
      lowercase: true,
      // Basic email format validation using a regex
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please fill a valid email address",
      ],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      // Custom validator for 10-digit phone number
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v); // Ensures exactly 10 digits
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
const Employee = mongoose.model("Employee", employeeSchema);
export default Employee;
