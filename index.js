import 'dotenv/config'; 
import express from 'express';
import connectDB from './utils/DbConnector.js'
import userRoutes from './router/userRouter.js'; 

const app = express();
const PORT = process.env.PORT || 5000;


app.use(express.json());


connectDB();


app.use('/api/users', userRoutes);


app.get('/', (req, res) => {
    res.send('Welcome to the Refactored Node.js MongoDB App!');
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the API at http://localhost:${PORT}/api/users`);
});
