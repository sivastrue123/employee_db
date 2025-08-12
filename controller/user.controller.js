import User from '../model/user.model.js'; 



const createUser = async (req, res) => {
    try {
        const { name, age, email } = req.body;

        if (!name || !age || !email) {
            return res.status(400).json({ message: 'All fields (name, age, email) are required.' });
        }

        const newUser = new User({
            name,
            age,
            email
        });

        await newUser.save();

        res.status(201).json({ message: 'User created successfully', user: newUser });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'User with this email already exists.', error: error.message });
        }
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({});
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


export { 
    createUser,
    getAllUsers
};

