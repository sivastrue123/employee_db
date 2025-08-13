import "dotenv/config";
import express from "express";
import connectDB from "./utils/DbConnector.js";

import employeeRoutes from "./router/employeeRouter.js";
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

connectDB();

app.use("/api/employee", employeeRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  console.log(
    `Access the Employee API at http://localhost:${PORT}/api/employee`
  );
});
