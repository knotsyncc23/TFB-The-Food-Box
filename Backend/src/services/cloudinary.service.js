import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env.js';

cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret
});

export const uploadImageBuffer = async (buffer, folder = 'uploads') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'image' },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                return resolve(result.secure_url);
            }
        );

        stream.end(buffer);
    });
};

export const uploadImageBufferDetailed = async (buffer, folder = 'uploads') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'image' },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                return resolve(result);
            }
        );

        stream.end(buffer);
    });
};

export const uploadVideoBuffer = async (buffer, folder = 'uploads') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'video' },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                return resolve(result.secure_url);
            }
        );

        stream.end(buffer);
    });
};

export const uploadFileBuffer = async (buffer, folder = 'uploads', options = {}) => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    const fileName = typeof options.fileName === 'string' ? options.fileName.trim() : '';
    const rawBaseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : '';
    // Prevent malformed public_ids like "name..pdf" caused by trailing dots in uploaded file names.
    const baseName = rawBaseName.replace(/[.\s]+$/g, '');
    const format = typeof options.format === 'string' && options.format.trim()
        ? options.format.trim().toLowerCase()
        : '';

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'raw',
                type: 'upload',
                access_mode: 'public',
                format: format || undefined,
                use_filename: Boolean(baseName),
                unique_filename: !baseName,
                filename_override: baseName || undefined
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                return resolve(result.secure_url);
            }
        );

        stream.end(buffer);
    });
};

const stripTrailingExtension = (value) => {
    if (!value) return '';
    return value.replace(/\.[a-z0-9]{1,10}$/i, '');
};

const extractRawPublicIdFromUrl = (fileUrl, options = {}) => {
    const preserveExtension = Boolean(options.preserveExtension);
    try {
        const url = new URL(String(fileUrl));
        const path = url.pathname || '';

        // Fast-path: common Cloudinary raw URL pattern
        const directMatch = preserveExtension
            ? path.match(/\/raw\/(?:upload|private|authenticated)\/(?:v\d+\/)?(.+?)\/?$/i)
            : path.match(/\/raw\/(?:upload|private|authenticated)\/(?:v\d+\/)?(.+?)(?:\.[^/.]+)?\/?$/i);
        if (directMatch?.[1]) {
            const decoded = decodeURIComponent(directMatch[1]);
            return preserveExtension ? decoded : stripTrailingExtension(decoded);
        }

        // Fallback parser for uncommon path variants
        const parts = path.split('/').filter(Boolean);
        const rawIndex = parts.findIndex((part) => part.toLowerCase() === 'raw');
        if (rawIndex === -1 || rawIndex + 2 >= parts.length) return null;

        // Skip "raw/<type>/"
        let start = rawIndex + 2;

        // Skip optional version segment like v1775911065
        if (/^v\d+$/i.test(parts[start])) {
            start += 1;
        }

        const publicPath = parts.slice(start).join('/').replace(/\/+$/, '');
        if (!publicPath) return null;

        const decoded = decodeURIComponent(publicPath);
        return preserveExtension ? decoded : stripTrailingExtension(decoded);
    } catch {
        return null;
    }
};

const extractRawFormatFromUrl = (fileUrl) => {
    try {
        const url = new URL(String(fileUrl));
        const path = url.pathname || '';
        const match = path.match(/\.([a-z0-9]+)$/i);
        return match ? match[1].toLowerCase() : '';
    } catch {
        return '';
    }
};

export const buildRawDownloadUrlFromFileUrl = (fileUrl, options = {}) => {
    if (!fileUrl) return '';
    const normalizedPublicId = extractRawPublicIdFromUrl(fileUrl);
    const exactPublicId = extractRawPublicIdFromUrl(fileUrl, { preserveExtension: true });
    if (!normalizedPublicId && !exactPublicId) return String(fileUrl);

    // Some legacy uploads keep a trailing dot/extension inside public_id (e.g. "name..pdf").
    // Those only resolve when we preserve the exact public_id from URL.
    const publicId = exactPublicId && /\.\.[a-z0-9]{1,10}$/i.test(exactPublicId)
        ? exactPublicId
        : (normalizedPublicId || exactPublicId);

    const format = options.format || extractRawFormatFromUrl(fileUrl) || 'pdf';
    const attachmentName = typeof options.fileName === 'string' && options.fileName.trim()
        ? options.fileName.trim()
        : 'menu.pdf';

    if (typeof cloudinary.utils?.private_download_url === 'function') {
        return cloudinary.utils.private_download_url(publicId, format, {
            resource_type: 'raw',
            type: 'upload',
            attachment: attachmentName
        });
    }

    return cloudinary.url(publicId, {
        resource_type: 'raw',
        type: 'upload',
        sign_url: true,
        secure: true,
        format,
        flags: 'attachment'
    });
};

