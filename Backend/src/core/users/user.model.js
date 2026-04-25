import mongoose from 'mongoose';

const normalizeOptionalUniqueValue = (value) => {
    if (value === null || value === undefined) {
        return undefined;
    }

    const normalized = String(value).trim();
    return normalized || undefined;
};

const userAddressSchema = new mongoose.Schema(
    {
        label: {
            type: String,
            enum: ['Home', 'Office', 'Other'],
            default: 'Home',
            index: true
        },
        street: {
            type: String,
            required: true,
            trim: true
        },
        additionalDetails: {
            type: String,
            default: '',
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        state: {
            type: String,
            required: true,
            trim: true
        },
        zipCode: {
            type: String,
            default: '',
            trim: true
        },
        formattedAddress: {
            type: String,
            default: '',
            trim: true
        },
        phone: {
            type: String,
            default: '',
            trim: true
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                // [lng, lat]
                type: [Number],
                default: undefined,
                validate: {
                    validator: (v) =>
                        v === undefined ||
                        (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n))),
                    message: 'location.coordinates must be [lng, lat]'
                }
            }
        },
        isDefault: {
            type: Boolean,
            default: false,
            index: true
        }
    },
    { _id: true, timestamps: true }
);

const currentLocationSchema = new mongoose.Schema(
    {
        label: {
            type: String,
            default: ''
        },
        street: {
            type: String,
            default: '',
            trim: true
        },
        additionalDetails: {
            type: String,
            default: '',
            trim: true
        },
        area: {
            type: String,
            default: '',
            trim: true
        },
        city: {
            type: String,
            default: '',
            trim: true
        },
        state: {
            type: String,
            default: '',
            trim: true
        },
        zipCode: {
            type: String,
            default: '',
            trim: true
        },
        address: {
            type: String,
            default: '',
            trim: true
        },
        formattedAddress: {
            type: String,
            default: '',
            trim: true
        },
        latitude: {
            type: Number,
            default: null
        },
        longitude: {
            type: Number,
            default: null
        },
        sourceType: {
            type: String,
            enum: ['gps', 'saved_address', 'map_pin', 'manual', 'unknown'],
            default: 'unknown'
        },
        sourceAddressId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        }
    },
    { _id: false, timestamps: true }
);

const userSchema = new mongoose.Schema(
    {
        phone: {
            type: String,
            required: true,
            trim: true
        },
        countryCode: {
            type: String,
            default: '+91'
        },
        name: {
            type: String
        },
        email: {
            type: String
        },
        appleId: {
            type: String,
            default: undefined,
            trim: true,
            set: normalizeOptionalUniqueValue
        },
        googleId: {
            type: String,
            default: undefined,
            trim: true,
            set: normalizeOptionalUniqueValue
        },
        profileImage: {
            type: String,
            default: ''
        },
        fcmTokens: {
            type: [String],
            default: []
        },
        fcmTokenMobile: {
            type: [String],
            default: []
        },
        dateOfBirth: {
            type: Date,
            default: null
        },
        anniversary: {
            type: Date,
            default: null
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other', 'prefer-not-to-say', ''],
            default: ''
        },
        referralCode: {
            type: String
        },
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodUser',
            default: null,
            index: true
        },
        referralCount: {
            type: Number,
            default: 0,
            min: 0
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        role: {
            type: String,
            default: 'USER'
        },
        currentLocation: {
            type: currentLocationSchema,
            default: () => ({})
        },
        addresses: {
            type: [userAddressSchema],
            default: []
        }
    },
    {
        collection: 'food_users',
        timestamps: true
    }
);

userSchema.index({ phone: 1 }, { unique: true });
userSchema.index(
    { appleId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            appleId: { $exists: true, $type: 'string' }
        }
    }
);
userSchema.index(
    { googleId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            googleId: { $exists: true, $type: 'string' }
        }
    }
);
userSchema.index({ 'addresses.location': '2dsphere' });

export const FoodUser = mongoose.model('FoodUser', userSchema);

export const ensureFoodUserIndexes = async () => {
    const collection = FoodUser.collection;
    const indexes = await collection.indexes();

    const rebuildIndexIfNeeded = async (indexName, fieldName) => {
        const existing = indexes.find((index) => index.name === indexName);
        const hasPartialFilter = Boolean(existing?.partialFilterExpression?.[fieldName]);

        if (existing && !hasPartialFilter) {
            await collection.dropIndex(indexName);
        }

        await collection.createIndex(
            { [fieldName]: 1 },
            {
                name: indexName,
                unique: true,
                partialFilterExpression: {
                    [fieldName]: { $exists: true, $type: 'string' }
                }
            }
        );
    };

    await rebuildIndexIfNeeded('appleId_1', 'appleId');
    await rebuildIndexIfNeeded('googleId_1', 'googleId');
};

