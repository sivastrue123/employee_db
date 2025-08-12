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
    const allEmployees = await Employee.find({});
    console.log(allEmployees,"This all Employees data")
    res.status(200).json(allEmployees);
  } catch (error) {
    console.error("Error fetching Employee:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
export { CreateEmployee,getAllEmployee };
