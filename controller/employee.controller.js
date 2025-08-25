import Employee from "../model/employee.model.js";

const createEmployee = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      department,
      position,
      hire_date,
      hourly_rate,
      profile_image,
      status,
      employee_id,
      role,
    } = req.body;
    if (
      !first_name ||
      !last_name ||
      !email ||
      !department ||
      !position ||
      !hire_date ||
      !hourly_rate ||
      !employee_id
    ) {
      return res.status(400).json({ message: "All Fields are required" });
    }
    const existingEmployee = await Employee.findOne({
      employee_id,
      isDeleted: false,
    });
    if (existingEmployee) {
      return res.status(409).json({ message: "Employe id  already in use" });
    }
    console.log(existingEmployee, String(employee_id));
    if (existingEmployee?.email === String(email)) {
      return res.status(409).json({ message: "email Id already exists" });
    }
    const newEmployee = new Employee({
      first_name,
      last_name,
      email,
      phone,
      department,
      position,
      hire_date,
      hourly_rate,
      status,
      profile_image,
      employee_id,
      role: role || "employee",
    });

    await newEmployee.save();

    res
      .status(201)
      .json({ message: "Employee Added SuccessFully", data: newEmployee });
  } catch (error) {
    console.error("Error Creating Employee:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const checkEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const existingEmployee = await Employee.findOne({
      email,
      isDeleted: false,
      status: "active",
    });
    if (existingEmployee) {
      return res.status(200).json({
        exists: true,
        message: "Email  exists",
        employee_details: existingEmployee,
      });
    }
    res.status(403).json({ exists: false, message: "No Access" });
  } catch (error) {
    console.error("Error checking email:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getAllEmployee = async (req, res) => {
  try {
    const allEmployees = await Employee.find({ isDeleted: false }).sort({
      status: 1,
    });

    res.status(200).json(allEmployees);
  } catch (error) {
    console.error("Error fetching Employee:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
const editEmployee = async (req, res) => {
  try {
    const { empId } = req.params;
    const {
      first_name,
      last_name,
      email,
      phone,
      department,
      position,
      hire_date,
      hourly_rate,
      profile_image,
      status,
      employee_id,
      role,
    } = req.body;

    if (!emplId) {
      return res
        .status(400)
        .json({ message: "Employee ID is required for editing." });
    }
    if (
      !first_name ||
      !last_name ||
      !email ||
      !department ||
      !position ||
      !hire_date ||
      !hourly_rate ||
      !employee_id ||
      !role
    ) {
      return res.status(400).json({ message: "All Fields are required" });
    }

    const updatedEmployee = await Employee.findOneAndUpdate(
      { _id: empId },
      {
        $set: {
          first_name,
          last_name,
          email,
          phone,
          department,
          position,
          hire_date,
          hourly_rate,
          profile_image,
          status,
          employee_id,
          role,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    res.status(200).json({
      message: "Employee updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    console.error("Error updating Employee:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const { employee_id } = req.params;
    if (!employee_id) {
      return res
        .status(400)
        .json({ message: "Employee ID is required for deletion." });
    }

    const deletedEmployee = await Employee.findOneAndUpdate(
      {
        _id: employee_id,
      },
      {
        $set: { isDeleted: true },
      },
      { new: true }
    );

    if (!deletedEmployee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting Employee:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export {
  createEmployee,
  getAllEmployee,
  editEmployee,
  deleteEmployee,
  checkEmail,
};
