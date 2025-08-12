import mongoose from 'mongoose'; 


const connectDB = async () => {
    try {
        const connectionString = process.env.MONGODB_CONNECTION_STRING;
        const dbName = process.env.DB_NAME;

        if (!connectionString || !dbName) {
            throw new Error('MongoDB connection string or database name not found in environment variables. Please check your .env file.');
        }

        await mongoose.connect(`${connectionString}/${dbName}`, {
            
        });
        console.log('MongoDB connected successfully!');
    } catch (error) {
       
        console.error('Error connecting to MongoDB:', error.message);
        process.exit(1);
    }
};

export default connectDB; 
