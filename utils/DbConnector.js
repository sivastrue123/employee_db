import mongoose from "mongoose";

const connectDB = async (connectionString, dbName) => {
  return mongoose.connect(connectionString, {
    dbName: dbName,
  });
};

export default connectDB;
