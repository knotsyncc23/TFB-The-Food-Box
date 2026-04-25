import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const locationSchema = z.object({
    label: z.string().max(50).optional().or(z.literal('')).transform((value) => String(value || '').trim()),
    street: z.string().max(200).optional().or(z.literal('')).transform((value) => String(value || '').trim()),
    additionalDetails: z.string().max(500).optional().or(z.literal('')).transform((value) => String(value || '').trim()),
    area: z.string().max(200).optional().or(z.literal('')).transform((value) => String(value || '').trim()),
    city: z.string().max(100).optional().or(z.literal('')).transform((value) => String(value || '').trim()),
    state: z.string().max(100).optional().or(z.literal('')).transform((value) => String(value || '').trim()),
    zipCode: z.string().max(20).optional().or(z.literal('')).transform((value) => String(value || '').trim()),
    address: z.string().max(500).optional().or(z.literal('')).transform((value) => String(value || '').trim()),
    formattedAddress: z.string().max(500).optional().or(z.literal('')).transform((value) => String(value || '').trim()),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    sourceType: z.enum(['gps', 'saved_address', 'map_pin', 'manual', 'unknown']).optional()
});

export const validateUpdateLocationDto = (body) => {
    const result = locationSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};
