import mongoose from 'mongoose';

const diningRequestSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true
        },
        requestedSettings: {
            isEnabled: { type: Boolean, required: true },
            maxGuests: { type: Number, required: true, min: 0 },
            diningType: { type: [String], required: true }
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        rejectionReason: {
            type: String,
            default: null
        }
    },
    {
        collection: 'food_dining_requests',
        timestamps: true
    }
);

diningRequestSchema.index({ restaurantId: 1, status: 1 });

export const FoodDiningRequest = mongoose.model('FoodDiningRequest', diningRequestSchema);
