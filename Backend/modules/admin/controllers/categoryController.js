import AdminCategoryManagement from '../models/AdminCategoryManagement.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { uploadToCloudinary } from '../../../shared/utils/cloudinaryService.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const normalizeFoodPreference = (value) => {
  if (!value) return 'all';

  const normalized = String(value).trim().toLowerCase();

  if (normalized === 'veg' || normalized === 'vegetarian') {
    return 'veg';
  }

  if (
    normalized === 'non-veg' ||
    normalized === 'non veg' ||
    normalized === 'nonveg' ||
    normalized === 'non_veg'
  ) {
    return 'non-veg';
  }

  return 'all';
};

/**
 * Get All Categories (Public - for user frontend)
 * GET /api/categories/public
 */
export const getPublicCategories = asyncHandler(async (req, res) => {
  try {
    // Only get active categories for public access
    const categories = await AdminCategoryManagement.find({ status: true })
      .select('name image _id type foodPreference')
      .sort({ createdAt: -1 })
      .lean();

    const formattedCategories = categories.map((category) => ({
      id: category._id.toString(),
      name: category.name,
      image: category.image,
      type: category.type || null,
      foodPreference: normalizeFoodPreference(category.foodPreference),
      slug: category.name.toLowerCase().replace(/\s+/g, '-')
    }));

    return successResponse(res, 200, 'Categories retrieved successfully', {
      categories: formattedCategories
    });
  } catch (error) {
    logger.error(`Error fetching public categories: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch categories');
  }
});

/**
 * Get All Categories (Admin)
 * GET /api/admin/categories
 */
export const getCategories = asyncHandler(async (req, res) => {
  try {
    const { limit = 100, offset = 0, search, priority, status } = req.query;

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } }
      ];
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
    }

    // Status filter
    if (status !== undefined) {
      query.status = status === 'true' || status === true;
    }

    // Get categories
    const categories = await AdminCategoryManagement.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    // Add serial numbers
    const categoriesWithSl = categories.map((category, index) => ({
      ...category,
      sl: parseInt(offset) + index + 1,
      id: category._id.toString(),
    }));

    const total = await AdminCategoryManagement.countDocuments(query);

    return successResponse(res, 200, 'Categories retrieved successfully', {
      categories: categoriesWithSl,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error(`Error fetching categories: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch categories');
  }
});

/**
 * Get Category by ID
 * GET /api/admin/categories/:id
 */
export const getCategoryById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const category = await AdminCategoryManagement.findById(id).lean();

    if (!category) {
      return errorResponse(res, 404, 'Category not found');
    }

    return successResponse(res, 200, 'Category retrieved successfully', {
      category: {
        ...category,
        id: category._id.toString()
      }
    });
  } catch (error) {
    logger.error(`Error fetching category: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch category');
  }
});

/**
 * Create Category
 * POST /api/admin/categories
 */
export const createCategory = asyncHandler(async (req, res) => {
  try {
    const { name, image, status, type, foodPreference } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return errorResponse(res, 400, 'Category name is required');
    }

    // Check if category with same name already exists
    const existingCategory = await AdminCategoryManagement.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });

    if (existingCategory) {
      return errorResponse(res, 400, 'Category with this name already exists');
    }

    let imageUrl = 'https://via.placeholder.com/40';

    // Handle image upload if file is provided (priority: file > URL string)
    if (req.file) {
      try {
        const folder = 'appzeto/admin/categories';
        const result = await uploadToCloudinary(req.file.buffer, {
          folder,
          resource_type: 'image',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'auto' },
            { quality: 'auto' }
          ]
        });
        imageUrl = result.secure_url;
        logger.info(`Image uploaded to Cloudinary: ${imageUrl}`);
      } catch (uploadError) {
        logger.error(`Error uploading image: ${uploadError.message}`);
        return errorResponse(res, 500, 'Failed to upload image');
      }
    } else if (image && typeof image === 'string' && image.trim() !== '') {
      // Use provided image URL if no file is uploaded
      imageUrl = image.trim();
    }

    // Create new category
    const categoryData = {
      name: name.trim(),
      image: imageUrl,
      type: type && type.trim() ? type.trim() : undefined,
      foodPreference: normalizeFoodPreference(foodPreference),
      priority: 'Normal', // Default priority
      status: status !== undefined ? status : true,
      description: '',
      createdBy: req.user._id,
      updatedBy: req.user._id,
    };

    const category = await AdminCategoryManagement.create(categoryData);

    logger.info(`Category created: ${category._id}`, {
      name: category.name,
      createdBy: req.user._id
    });

    return successResponse(res, 201, 'Category created successfully', {
      category: {
        ...category.toObject(),
        id: category._id.toString()
      }
    });
  } catch (error) {
    logger.error(`Error creating category: ${error.message}`);
    
    if (error.code === 11000) {
      return errorResponse(res, 400, 'Category with this name already exists');
    }
    
    return errorResponse(res, 500, 'Failed to create category');
  }
});

/**
 * Update Category
 * PUT /api/admin/categories/:id
 */
export const updateCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image, status, type, foodPreference } = req.body;

    const category = await AdminCategoryManagement.findById(id);

    if (!category) {
      return errorResponse(res, 404, 'Category not found');
    }

    // Check if name is being changed and if it conflicts with existing category
    if (name && name.trim() !== category.name) {
      const existingCategory = await AdminCategoryManagement.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id }
      });

      if (existingCategory) {
        return errorResponse(res, 400, 'Category with this name already exists');
      }
    }

    // Handle image upload if file is provided (priority: file > existing image > URL string)
    let imageUrl = category.image; // Keep existing image by default
    
    if (req.file) {
      try {
        const folder = 'appzeto/admin/categories';
        const result = await uploadToCloudinary(req.file.buffer, {
          folder,
          resource_type: 'image',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'auto' },
            { quality: 'auto' }
          ]
        });
        imageUrl = result.secure_url;
        logger.info(`Image uploaded to Cloudinary: ${imageUrl}`);
      } catch (uploadError) {
        logger.error(`Error uploading image: ${uploadError.message}`);
        return errorResponse(res, 500, 'Failed to upload image');
      }
    } else if (image && typeof image === 'string' && image.trim() !== '') {
      // Use provided image URL if no file is uploaded
      imageUrl = image.trim();
    }

    // Update fields
    if (name !== undefined) category.name = name.trim();
    if (imageUrl !== undefined) category.image = imageUrl;
    if (type !== undefined) category.type = type && type.trim() ? type.trim() : undefined;
    if (foodPreference !== undefined) category.foodPreference = normalizeFoodPreference(foodPreference);
    if (status !== undefined) category.status = status;
    category.updatedBy = req.user._id;

    await category.save();

    logger.info(`Category updated: ${id}`, {
      updatedBy: req.user._id
    });

    return successResponse(res, 200, 'Category updated successfully', {
      category: {
        ...category.toObject(),
        id: category._id.toString()
      }
    });
  } catch (error) {
    logger.error(`Error updating category: ${error.message}`);
    
    if (error.code === 11000) {
      return errorResponse(res, 400, 'Category with this name already exists');
    }
    
    return errorResponse(res, 500, 'Failed to update category');
  }
});

/**
 * Delete Category
 * DELETE /api/admin/categories/:id
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const category = await AdminCategoryManagement.findById(id);

    if (!category) {
      return errorResponse(res, 404, 'Category not found');
    }

    await AdminCategoryManagement.deleteOne({ _id: id });

    logger.info(`Category deleted: ${id}`, {
      deletedBy: req.user._id
    });

    return successResponse(res, 200, 'Category deleted successfully');
  } catch (error) {
    logger.error(`Error deleting category: ${error.message}`);
    return errorResponse(res, 500, 'Failed to delete category');
  }
});

/**
 * Toggle Category Status
 * PATCH /api/admin/categories/:id/status
 */
export const toggleCategoryStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const category = await AdminCategoryManagement.findById(id);

    if (!category) {
      return errorResponse(res, 404, 'Category not found');
    }

    category.status = !category.status;
    category.updatedBy = req.user._id;
    await category.save();

    logger.info(`Category status toggled: ${id}`, {
      status: category.status,
      updatedBy: req.user._id
    });

    return successResponse(res, 200, 'Category status updated successfully', {
      category: {
        ...category.toObject(),
        id: category._id.toString()
      }
    });
  } catch (error) {
    logger.error(`Error toggling category status: ${error.message}`);
    return errorResponse(res, 500, 'Failed to update category status');
  }
});

/**
 * Update Category Priority
 * PATCH /api/admin/categories/:id/priority
 */
export const updateCategoryPriority = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!priority || !['High', 'Normal', 'Low'].includes(priority)) {
      return errorResponse(res, 400, 'Valid priority (High, Normal, Low) is required');
    }

    const category = await AdminCategoryManagement.findById(id);

    if (!category) {
      return errorResponse(res, 404, 'Category not found');
    }

    category.priority = priority;
    category.updatedBy = req.user._id;
    await category.save();

    logger.info(`Category priority updated: ${id}`, {
      priority,
      updatedBy: req.user._id
    });

    return successResponse(res, 200, 'Category priority updated successfully', {
      category: {
        ...category.toObject(),
        id: category._id.toString()
      }
    });
  } catch (error) {
    logger.error(`Error updating category priority: ${error.message}`);
    return errorResponse(res, 500, 'Failed to update category priority');
  }
});

