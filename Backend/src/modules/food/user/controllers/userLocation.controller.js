import { sendResponse } from '../../../../utils/response.js';
import { getCurrentLocation, updateCurrentLocation } from '../services/userLocation.service.js';
import { validateUpdateLocationDto } from '../validators/userLocation.validator.js';

export const getCurrentLocationController = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const result = await getCurrentLocation(userId);
        return sendResponse(res, 200, 'Current location retrieved successfully', result);
    } catch (error) {
        next(error);
    }
};

export const updateCurrentLocationController = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const dto = validateUpdateLocationDto(req.body);
        const result = await updateCurrentLocation(userId, dto);
        return sendResponse(res, 200, 'Current location updated successfully', result);
    } catch (error) {
        next(error);
    }
};
