import "dotenv/config";
import express from "express";
import connectDB from "./utils/DbConnector.js";
import { URI, DATABASE_NAME } from "./config.js";
import employeeRoutes from "./router/employeeRouter.js";
import attendanceRoutes from "./router/attendanceRouter.js";
import clientRoutes from "./router/clientRouter.js";
import cors from "cors";
import pushRoutes from "./router/webPush.js";
import worklogRoutes from "./router/worklog.routes.js";
import amcRoutes from "./router/amcRouter.js"

const app = express();
const PORT = process.env.PORT || 8080;
app.disable("x-powered-by");
app.disable("etag");
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: ["http://localhost:5173", "https://ez-emp-ui.azurewebsites.net"],

    credentials: true,
  })
);

app.use("/api/employee", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/worklog", worklogRoutes);
app.use("/api/amcInfo", amcRoutes);
app.get("/api/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/", (_req, res) => res.status(200).send("OK"));
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
      console.log("")
      console.log(`Try: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};
process.on("unhandledRejection", (e) => {
  console.error(e);
  process.exit(1);
});
process.on("uncaughtException", (e) => {
  console.error(e);
  process.exit(1);
});

startingServer();
