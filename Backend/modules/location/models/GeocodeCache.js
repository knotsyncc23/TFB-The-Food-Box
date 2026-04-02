import mongoose from "mongoose";

const geocodeCacheSchema = new mongoose.Schema(
  {
    geoKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    address_components: {
      city: String,
      state: String,
      country: String,
      area: String,
      road: String,
      building: String,
      postcode: String,
    },
    formatted_address: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Expire old cache randomly after 90 days to slowly discover updated mapping data automatically
geocodeCacheSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 },
);

export default mongoose.model("GeocodeCache", geocodeCacheSchema);
