// src/models/index.js

import mongoose from 'mongoose';

// --- 1. Dealer Schema ---
const DealerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
}, { timestamps: true });

const Dealer = mongoose.model('Dealer', DealerSchema);

// ---------------------------------------------------------------------

// --- 2. Customer Schema ---
const CustomerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
}, { timestamps: true });

const Customer = mongoose.model('Customer', CustomerSchema);

// ---------------------------------------------------------------------

// --- 3. AmcInfo Schema ---
const AmcInfoSchema = new mongoose.Schema({
    // Use Mongoose References (ObjectId) to link to Dealer and Customer
    dealer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dealer', // Refers to the Dealer model
        required: true,
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer', // Refers to the Customer model
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['Active', 'Expired', 'Extension'],
        required: true,
    },
    amcFrom: {
        type: Date,
        required: true,
    },
    amcTo: {
        type: Date,
        required: true,
    },
    amcMonth: {
        type: String,
        enum: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
        required: true,
    },
}, { timestamps: true });

const AmcInfo = mongoose.model('AmcInfo', AmcInfoSchema);

// ---------------------------------------------------------------------

// Export all models
export {
    Dealer,
    Customer,
    AmcInfo
};