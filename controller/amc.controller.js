// src/controllers/amcController.js

import { Dealer, Customer, AmcInfo } from "../model/amcInfo.js"

/**
 * Helper function to handle the creation of a new entity (Dealer or Customer).
 * It checks for duplicates before creating.
 * @param {object} Model - The Mongoose Model (Dealer or Customer).
 * @param {string} newName - The name provided by the user.
 * @returns {Promise<mongoose.Types.ObjectId>} The ID of the existing or newly created entity.
 */
const createNewEntity = async (Model, newName) => {
    const trimmedName = newName ? newName.trim() : '';
    
    // Server-side validation against an empty name
    if (trimmedName === '') {
        throw new Error(`Name for ${Model.modelName} is required.`);
    }
    
    // 1. Check if the entity already exists (due to unique: true in schema)
    let entity = await Model.findOne({ name: trimmedName });

    if (!entity) {
        // 2. If it doesn't exist, create it
        entity = await Model.create({ name: trimmedName });
    }
    
    return entity._id;
};

/**
 * Core logic to check the request body for 'new' Dealer/Customer entries
 * and create those entities before cleaning the data for the Mongoose save operation.
 * @param {object} body - The raw request body from the frontend.
 * @returns {Promise<object>} Cleaned data ready for Mongoose.
 */
const preprocessAmcBody = async (body) => {
    let finalDealerId = body.dealer;
    let finalCustomerId = body.customer;

    // 1. Handle New Dealer Creation
    if (body.dealer === 'new') {
        if (!body.newDealerName) {
            throw new Error('New Dealer name is missing.');
        }
        finalDealerId = await createNewEntity(Dealer, body.newDealerName);
        console.log(`Preprocessed new Dealer ID: ${finalDealerId}`);
    }

    // 2. Handle New Customer Creation
    if (body.customer === 'new') {
        if (!body.newCustomerName) {
            throw new Error('New Customer name is missing.');
        }
        finalCustomerId = await createNewEntity(Customer, body.newCustomerName);
        console.log(`Preprocessed new Customer ID: ${finalCustomerId}`);
    }

    // 3. Return the cleaned data ready for Mongoose
    return {
        dealer: finalDealerId,
        customer: finalCustomerId,
        description: body.description,
        status: body.status,
        amcFrom: new Date(body.amcFrom), 
        amcTo: new Date(body.amcTo),
        amcMonth: body.amcMonth,
    };
};

// =========================================================================
//                             CRUD Handlers
// =========================================================================

/**
 * @route   POST /api/amc
 * @desc    Create a new AMC record (handles new entity creation).
 */
export const createAmc = async (req, res) => {
    try {
        const cleanedData = await preprocessAmcBody(req.body);

        const amc = await AmcInfo.create(cleanedData);
        
        // Populate references to get the names for the frontend
        await amc.populate('dealer customer');

        // Format the response to match the frontend's AmcInfo interface structure
        res.status(201).json({
            id: amc._id,
            dealerName: amc.dealer.name,
            customerName: amc.customer.name,
            description: amc.description,
            status: amc.status,
            // Format Dates as YYYY-MM-DD strings for frontend consistency
            amcFrom: amc.amcFrom.toISOString().split('T')[0], 
            amcTo: amc.amcTo.toISOString().split('T')[0],
            amcMonth: amc.amcMonth,
        });
    } catch (error) {
        console.error('Error creating AMC:', error);
        res.status(400).json({ message: 'Failed to create AMC record.', error: error.message });
    }
};

/**
 * @route   PUT /api/amc/:id
 * @desc    Update an existing AMC record.
 */
export const updateAmc = async (req, res) => {
    try {
        const amcId = req.params.id;
        const cleanedData = await preprocessAmcBody(req.body);
        
        const updatedAmc = await AmcInfo.findByIdAndUpdate(amcId, cleanedData, { new: true, runValidators: true })
                                         .populate('dealer customer');

        if (!updatedAmc) {
            return res.status(404).json({ message: 'AMC record not found.' });
        }

        // Format the response to match the frontend's AmcInfo interface structure
        res.status(200).json({
            id: updatedAmc._id,
            dealerName: updatedAmc.dealer.name,
            customerName: updatedAmc.customer.name,
            description: updatedAmc.description,
            status: updatedAmc.status,
            amcFrom: updatedAmc.amcFrom.toISOString().split('T')[0],
            amcTo: updatedAmc.amcTo.toISOString().split('T')[0],
            amcMonth: updatedAmc.amcMonth,
        });
    } catch (error) {
        console.error('Error updating AMC:', error);
        res.status(400).json({ message: 'Failed to update AMC record.', error: error.message });
    }
};

/**
 * @route   GET /api/amc
 * @desc    Get all AMC records.
 */
export const getAmcList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page
        const skip = (page - 1) * limit;

        // 1. Get total number of documents (for pagination metadata)
        const totalDocs = await AmcInfo.countDocuments();
        
        // 2. Fetch paginated data
        const amcList = await AmcInfo.find()
            .populate('dealer customer')
            .skip(skip) // Skip records based on page number
            .limit(limit) // Limit records based on page size
            .lean();

        // Map the results to match the frontend's expected AmcInfo interface
        const formattedList = amcList.map(amc => ({
            id: amc._id.toString(),
            dealerName: amc.dealer.name,
            customerName: amc.customer.name,
            description: amc.description,
            status: amc.status,
            amcFrom: amc.amcFrom.toISOString().split('T')[0],
            amcTo: amc.amcTo.toISOString().split('T')[0],
            amcMonth: amc.amcMonth,
        }));

        // Return the data AND the pagination metadata
        res.status(200).json({
            data: formattedList,
            meta: {
                totalRecords: totalDocs,
                totalPages: Math.ceil(totalDocs / limit),
                currentPage: page,
                pageSize: limit,
            }
        });
    } catch (error) {
        console.error('Error fetching AMC list:', error);
        res.status(500).json({ message: 'Failed to fetch AMC list.' });
    }
};

// =========================================================================
//                            Dropdown Data Handlers
// =========================================================================

/**
 * @route   GET /api/dealers
 * @desc    Get all Dealers (for dropdowns).
 */
export const getDealers = async (req, res) => {
    try {
        const dealers = await Dealer.find().select('_id name');
        // Map to match the EntityOption format { id, name }
        const formattedDealers = dealers.map(d => ({ id: d._id.toString(), name: d.name }));
        res.status(200).json(formattedDealers);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch dealers.' });
    }
};

/**
 * @route   GET /api/customers
 * @desc    Get all Customers (for dropdowns).
 */
export const getCustomers = async (req, res) => {
    try {
        const customers = await Customer.find().select('_id name');
        // Map to match the EntityOption format { id, name }
        const formattedCustomers = customers.map(c => ({ id: c._id.toString(), name: c.name }));
        res.status(200).json(formattedCustomers);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch customers.' });
    }
};