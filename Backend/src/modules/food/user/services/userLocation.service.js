import { FoodUser } from '../../../../core/users/user.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';

const normalizeText = (value) => String(value || '').trim();

const buildFormattedAddress = (payload = {}) => {
    const parts = [
        normalizeText(payload.additionalDetails),
        normalizeText(payload.street),
        normalizeText(payload.city),
        normalizeText(payload.state),
        normalizeText(payload.zipCode)
    ].filter(Boolean);

    return normalizeText(payload.formattedAddress) || normalizeText(payload.address) || parts.join(', ');
};

export const getCurrentLocation = async (userId) => {
    const user = await FoodUser.findById(userId).select('currentLocation').lean();
    return { location: user?.currentLocation || null };
};

export const updateCurrentLocation = async (userId, dto) => {
    const user = await FoodUser.findById(userId).select('currentLocation');
    if (!user) throw new ValidationError('User not found');

    user.currentLocation = {
        label: normalizeText(dto.label),
        street: normalizeText(dto.street),
        additionalDetails: normalizeText(dto.additionalDetails),
        area: normalizeText(dto.area || dto.additionalDetails || dto.street),
        city: normalizeText(dto.city),
        state: normalizeText(dto.state),
        zipCode: normalizeText(dto.zipCode),
        address: buildFormattedAddress(dto),
        formattedAddress: buildFormattedAddress(dto),
        latitude: Number(dto.latitude),
        longitude: Number(dto.longitude),
        sourceType: dto.sourceType || 'unknown',
        sourceAddressId: null
    };

    await user.save();
    return { location: user.currentLocation?.toObject?.() || user.currentLocation };
};
