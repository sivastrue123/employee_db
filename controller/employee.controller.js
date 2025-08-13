import Employee from "../model/employee.model.js";

const CreateEmployee = async (req, res) => {
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
    } = req.body;
    if (
      !first_name ||
      !last_name ||
      !email ||
      !department ||
      !position ||
      !hire_date ||
      !hourly_rate
    ) {
      return res.status(400).json({ message: "All Fields are required" });
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
    const { employee_id } = req.params;
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
    } = req.body;

    if (!employee_id) {
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
      !hourly_rate
    ) {
      return res.status(400).json({ message: "All Fields are required" });
    }

    const updatedEmployee = await Employee.findOneAndUpdate(
      { _id: employee_id },
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

    const deletedEmployee = await Employee.findOneAndDelete({
      employee_id: employee_id,
    });

    if (!deletedEmployee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting Employee:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export { CreateEmployee, getAllEmployee, editEmployee, deleteEmployee };
