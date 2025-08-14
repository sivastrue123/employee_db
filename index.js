import "dotenv/config";
import express from "express";
import connectDB from "./utils/DbConnector.js";
import { URI, DATABASE_NAME } from "./config.js";
import employeeRoutes from "./router/employeeRouter.js";
import attendanceRoutes from "./router/attendanceRouter.js";
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use("/api/employee", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
const startingServer = async () => {
  try {
    if (URI && DATABASE_NAME) {
      await connectDB(URI, DATABASE_NAME);
    } else {
      throw "Either URI or Database name is an empty string";
    }
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(
        `Access the Employee API at http://localhost:${PORT}/api/employee`
      );
    });
  } catch (error) {
    console.log(error);
  }
};
startingServer();
