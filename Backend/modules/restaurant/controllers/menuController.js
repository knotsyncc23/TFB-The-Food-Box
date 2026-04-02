import Menu from '../models/Menu.js';
import Restaurant from '../models/Restaurant.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import mongoose from 'mongoose';

// Derive the base item price from variations when present.
// If valid variation prices exist, returns the lowest of them.
// Otherwise falls back to the explicitly provided item price (or 0).
const deriveBasePriceFromVariations = (rawPrice, variations) => {
  if (Array.isArray(variations) && variations.length > 0) {
    const prices = variations
      .map((v) => {
        if (!v) return null;
        const value =
          typeof v.price === 'number'
            ? v.price
            : Number.isFinite(Number(v.price))
              ? Number(v.price)
              : null;
        return Number.isFinite(value) && value >= 0 ? value : null;
      })
      .filter((p) => p != null);

    if (prices.length > 0) {
      return Math.min(...prices);
    }
  }

  const numericPrice =
    typeof rawPrice === 'number' ? rawPrice : Number(rawPrice);

  return Number.isFinite(numericPrice) && numericPrice >= 0
    ? numericPrice
    : 0;
};

// Items that are explicitly unavailable (boolean false or stringy false from JSON/forms)
const isItemAvailableForPublic = (item) => {
  if (!item || typeof item !== "object") return false;
  const v = item.isAvailable;
  if (v === false) return false;
  if (v === "false" || v === "False" || v === 0 || v === "0") return false;
  return true;
};

// Backward-compatible approval check for public visibility.
// Supports legacy formats, empty/invalid status strings, and non-standard enum values.
const isPubliclyApproved = (item) => {
  if (!item || typeof item !== "object") return false;

  if (item.rejectedAt) return false;

  const status = String(item.approvalStatus ?? "")
    .trim()
    .toLowerCase();

  if (status === "approved") return true;
  if (status === "rejected") return false;
  // Pending: still list on customer menu (only rejected stays hidden). Admin rejects bad items.
  if (status === "pending") return true;

  if (item.isApproved === true) return true;
  if (item.approvedAt && !item.rejectedAt) return true;

  // Empty status, unknown strings, or legacy docs without approval fields: visible
  // (avoids hiding items when approvalStatus is "", missing, or client sends odd values)
  return true;
};

// Get menu for a restaurant
export const getMenu = asyncHandler(async (req, res) => {
  // Restaurant is attached by authenticate middleware
  const restaurantId = req.restaurant._id;

  // Find or create menu
  let menu = await Menu.findOne({ restaurant: restaurantId });
  
  if (!menu) {
    // Create empty menu
    menu = new Menu({
      restaurant: restaurantId,
      sections: [],
      isActive: true,
    });
    await menu.save();
  }

  return successResponse(res, 200, 'Menu retrieved successfully', {
    menu: {
      sections: menu.sections || [],
      isActive: menu.isActive,
    },
  });
});

// Update menu (upsert)
export const updateMenu = asyncHandler(async (req, res) => {
  // Restaurant is attached by authenticate middleware
  const restaurantId = req.restaurant._id;
  const { sections } = req.body;
  // CRITICAL: Get existing menu FIRST to preserve approval status fields
  const existingMenu = await Menu.findOne({ restaurant: restaurantId });
  if (existingMenu) {
  }
  
  // Debug: Log incoming images data
  if (sections && Array.isArray(sections)) {
    sections.forEach((section, sIdx) => {
      if (section.items && Array.isArray(section.items)) {
        section.items.forEach((item, iIdx) => {
        });
      }
      // Also check subsections
      if (section.subsections && Array.isArray(section.subsections)) {
        section.subsections.forEach((subsection, ssIdx) => {
          if (subsection.items && Array.isArray(subsection.items)) {
            subsection.items.forEach((item, iIdx) => {
            });
          }
        });
      }
    });
  }

  // Normalize and validate sections
  const normalizedSections = Array.isArray(sections) ? sections.map((section, index) => {
    // Find existing section to preserve approval status
    const existingSection = existingMenu?.sections?.find(
      (s) => String(s.id) === String(section.id),
    );
    
    return {
      id: section.id || `section-${index}`,
      name: section.name || "Unnamed Section",
      items: Array.isArray(section.items) ? section.items.map(item => {
        // CRITICAL: Find existing item to preserve approval status fields
        const existingItem = existingSection?.items?.find(i => String(i.id) === String(item.id));
        
        return {
      id: String(item.id || Date.now() + Math.random()),
      name: item.name || "Unnamed Item",
      nameArabic: item.nameArabic || "",
      image: item.image || "",
      category: item.category || section.name,
      rating: item.rating ?? 0.0,
      reviews: item.reviews ?? 0,
      price: deriveBasePriceFromVariations(item.price, item.variations),
      stock: item.stock || "Unlimited",
      discount: item.discount || null,
      originalPrice: item.originalPrice || null,
      foodType: item.foodType || "Non-Veg",
      availabilityTimeStart: item.availabilityTimeStart || "12:01 AM",
      availabilityTimeEnd: item.availabilityTimeEnd || "11:57 PM",
      description: item.description || "",
      discountType: item.discountType || "Percent",
      discountAmount: item.discountAmount ?? 0.0,
      isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
      isRecommended: item.isRecommended || false,
      variations: Array.isArray(item.variations) ? item.variations.map(v => ({
        id: String(v.id || Date.now() + Math.random()),
        name: v.name || "",
        price: v.price || 0,
        stock: v.stock || "Unlimited",
      })) : [],
      tags: Array.isArray(item.tags) ? item.tags : [],
      nutrition: Array.isArray(item.nutrition) ? item.nutrition : [],
      allergies: Array.isArray(item.allergies) ? item.allergies : [],
      photoCount: item.photoCount ?? 1,
      // Additional fields for complete item details
      subCategory: item.subCategory || "",
      servesInfo: item.servesInfo || "",
      itemSize: item.itemSize || "",
      itemSizeQuantity: item.itemSizeQuantity || "",
      itemSizeUnit: item.itemSizeUnit || "piece",
      gst: item.gst ?? 0,
      preparationTime: existingItem?.preparationTime || item.preparationTime || "",
      images: (() => {
        // Ensure images array is properly handled - CRITICAL: Preserve all images
        if (Array.isArray(item.images)) {
          const filteredImages = item.images.filter(img => {
            const isValid = img && typeof img === 'string' && img.trim() !== '';
            if (!isValid) {
            }
            return isValid;
          });
          if (filteredImages.length !== item.images.length) {
            console.warn(`  - WARNING: Some images were filtered out! Original: ${item.images.length}, Filtered: ${filteredImages.length}`);
          }
          return filteredImages;
        } else if (item.image && typeof item.image === 'string' && item.image.trim() !== '') {
          return [item.image];
        } else {
          return [];
        }
      })(),
      // CRITICAL: Preserve approval status fields from existing item
      // Restaurant should NOT be able to overwrite these fields
      approvalStatus: existingItem?.approvalStatus || item.approvalStatus || 'pending',
      rejectionReason: existingItem?.rejectionReason || item.rejectionReason || '',
      requestedAt: existingItem?.requestedAt || item.requestedAt || (item.approvalStatus === 'pending' ? new Date() : undefined),
      approvedAt: existingItem?.approvedAt || item.approvedAt,
      approvedBy: existingItem?.approvedBy || item.approvedBy,
      rejectedAt: existingItem?.rejectedAt || item.rejectedAt,
    };
      }) : [],
    subsections: Array.isArray(section.subsections) ? section.subsections.map(subsection => {
      // Find existing subsection to preserve approval status
      const existingSubsection = existingSection?.subsections?.find(
        (s) => String(s.id) === String(subsection.id),
      );
      
      return {
        id: subsection.id || `subsection-${Date.now()}`,
        name: subsection.name || "Unnamed Subsection",
        items: Array.isArray(subsection.items) ? subsection.items.map(item => {
          // CRITICAL: Find existing item to preserve approval status fields
          const existingItem = existingSubsection?.items?.find(i => String(i.id) === String(item.id));
          
          return {
        id: String(item.id || Date.now() + Math.random()),
        name: item.name || "Unnamed Item",
        nameArabic: item.nameArabic || "",
        image: item.image || "",
        category: item.category || section.name,
      rating: item.rating ?? 0.0,
      reviews: item.reviews ?? 0,
      price: deriveBasePriceFromVariations(item.price, item.variations),
        stock: item.stock || "Unlimited",
        discount: item.discount || null,
        originalPrice: item.originalPrice || null,
        foodType: item.foodType || "Non-Veg",
        availabilityTimeStart: item.availabilityTimeStart || "12:01 AM",
        availabilityTimeEnd: item.availabilityTimeEnd || "11:57 PM",
        description: item.description || "",
        discountType: item.discountType || "Percent",
        discountAmount: item.discountAmount ?? 0.0,
        isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
        isRecommended: item.isRecommended || false,
        variations: Array.isArray(item.variations) ? item.variations.map(v => ({
          id: String(v.id || Date.now() + Math.random()),
          name: v.name || "",
          price: v.price || 0,
          stock: v.stock || "Unlimited",
        })) : [],
        tags: Array.isArray(item.tags) ? item.tags : [],
        nutrition: Array.isArray(item.nutrition) ? item.nutrition : [],
        allergies: Array.isArray(item.allergies) ? item.allergies : [],
        photoCount: item.photoCount ?? 1,
        // Additional fields for complete item details
        subCategory: item.subCategory || "",
        servesInfo: item.servesInfo || "",
        itemSize: item.itemSize || "",
        itemSizeQuantity: item.itemSizeQuantity || "",
        itemSizeUnit: item.itemSizeUnit || "piece",
        gst: item.gst ?? 0,
        preparationTime: existingItem?.preparationTime || item.preparationTime || "",
        images: (() => {
          // Ensure images array is properly handled
          if (Array.isArray(item.images) && item.images.length > 0) {
            const filteredImages = item.images.filter(img => img && typeof img === 'string' && img.trim() !== '');
            return filteredImages;
          } else if (item.image && item.image.trim() !== '') {
            return [item.image];
          } else {
            return [];
          }
        })(),
        // CRITICAL: Preserve approval status fields from existing item
        // Restaurant should NOT be able to overwrite these fields
        approvalStatus: existingItem?.approvalStatus || item.approvalStatus || 'pending',
        rejectionReason: existingItem?.rejectionReason || item.rejectionReason || '',
        requestedAt: existingItem?.requestedAt || item.requestedAt || (item.approvalStatus === 'pending' ? new Date() : undefined),
        approvedAt: existingItem?.approvedAt || item.approvedAt,
        approvedBy: existingItem?.approvedBy || item.approvedBy,
        rejectedAt: existingItem?.rejectedAt || item.rejectedAt,
      };
        }) : [],
      };
    }) : [],
    isEnabled: section.isEnabled !== undefined ? section.isEnabled : true,
    order: section.order !== undefined ? section.order : index,
  };
  }) : [];

  // Find or create menu
  let menu = await Menu.findOne({ restaurant: restaurantId });
  
  // Debug: Log normalized sections before saving
  normalizedSections.forEach((section, sIdx) => {
    if (section.items && Array.isArray(section.items)) {
      section.items.forEach((item, iIdx) => {
      });
    }
  });
  
  if (!menu) {
    menu = new Menu({
      restaurant: restaurantId,
      sections: normalizedSections,
      isActive: true,
    });
  } else {
    // Use set method to ensure Mongoose properly tracks changes
    menu.set('sections', normalizedSections);
    // Mark sections as modified to ensure Mongoose saves nested arrays properly
    // This is CRITICAL for nested arrays in Mongoose
    menu.markModified('sections');
    // Force Mongoose to treat this as a direct assignment
    menu.isNew = false;
  }
  await menu.save();
  // Debug: Verify what was saved - reload from database
  const savedMenu = await Menu.findOne({ restaurant: restaurantId }).lean();
  if (savedMenu && savedMenu.sections) {
    savedMenu.sections.forEach((section, sIdx) => {
      if (section.items && Array.isArray(section.items)) {
        section.items.forEach((item, iIdx) => {
          if (item.images && item.images.length === 1 && item.photoCount > 1) {
            console.error(`  - ERROR: Only 1 image saved but photoCount is ${item.photoCount}!`);
          }
        });
      }
    });
  }

  return successResponse(res, 200, 'Menu updated successfully', {
    menu: {
      sections: menu.sections,
      isActive: menu.isActive,
    },
  });
});

// Add a new section (category)
export const addSection = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return errorResponse(res, 400, 'Section name is required');
  }

  // Find or create menu
  let menu = await Menu.findOne({ restaurant: restaurantId });
  
  if (!menu) {
    menu = new Menu({
      restaurant: restaurantId,
      sections: [],
      isActive: true,
    });
  }

  // Check if section with same name already exists
  const existingSection = menu.sections.find(
    s => s.name.toLowerCase().trim() === name.toLowerCase().trim()
  );

  if (existingSection) {
    return errorResponse(res, 400, 'Section with this name already exists');
  }

  // Create new section
  const newSection = {
    id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    items: [],
    subsections: [],
    isEnabled: true,
    order: menu.sections.length,
  };

  menu.sections.push(newSection);
  await menu.save();

  return successResponse(res, 201, 'Section added successfully', {
    section: newSection,
    menu: {
      sections: menu.sections,
      isActive: menu.isActive,
    },
  });
});

// Add a new item to a section
export const addItemToSection = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const { sectionId, item } = req.body;

  if (!sectionId) {
    return errorResponse(res, 400, 'Section ID is required');
  }

  if (!item || !item.name || item.price === undefined) {
    return errorResponse(res, 400, 'Item name and price are required');
  }

  // Find menu
  const menu = await Menu.findOne({ restaurant: restaurantId });
  
  if (!menu) {
    return errorResponse(res, 404, 'Menu not found');
  }

  // Find section
  const section = menu.sections.find(s => s.id === sectionId);
  if (!section) {
    return errorResponse(res, 404, 'Section not found');
  }

  // Normalize item data
  const basePrice = deriveBasePriceFromVariations(item.price, item.variations);
  const newItem = {
    id: String(item.id || Date.now() + Math.random()),
    name: item.name.trim(),
    nameArabic: item.nameArabic || "",
    image: item.image || "",
    category: item.category || section.name,
    rating: item.rating ?? 0.0,
    reviews: item.reviews ?? 0,
    price: basePrice,
    stock: item.stock || "Unlimited",
    discount: item.discount || null,
    originalPrice: item.originalPrice || null,
    foodType: item.foodType || "Non-Veg",
    availabilityTimeStart: item.availabilityTimeStart || "12:01 AM",
    availabilityTimeEnd: item.availabilityTimeEnd || "11:57 PM",
    description: item.description || "",
    discountType: item.discountType || "Percent",
    discountAmount: item.discountAmount ?? 0.0,
    isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
    isRecommended: item.isRecommended || false,
    variations: Array.isArray(item.variations) ? item.variations.map(v => ({
      id: String(v.id || Date.now() + Math.random()),
      name: v.name || "",
      price: Number(v.price) || 0,
      stock: v.stock || "Unlimited",
    })) : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
    nutrition: Array.isArray(item.nutrition) ? item.nutrition : [],
    allergies: Array.isArray(item.allergies) ? item.allergies : [],
    photoCount: item.photoCount ?? 1,
    // Additional fields for complete item details
    subCategory: item.subCategory || "",
    servesInfo: item.servesInfo || "",
    itemSize: item.itemSize || "",
    itemSizeQuantity: item.itemSizeQuantity || "",
    itemSizeUnit: item.itemSizeUnit || "piece",
    gst: item.gst ?? 0,
    images: Array.isArray(item.images) && item.images.length > 0 
      ? item.images.filter(img => img && typeof img === 'string' && img.trim() !== '')
      : (item.image && item.image.trim() !== '' ? [item.image] : []),
    preparationTime: item.preparationTime || "",
    approvalStatus: 'pending', // New items require admin approval
    requestedAt: new Date(),
  };

  section.items.push(newItem);
  await menu.save();

  return successResponse(res, 201, 'Item added successfully', {
    item: newItem,
    menu: {
      sections: menu.sections,
      isActive: menu.isActive,
    },
  });
});

// Add a subsection to a section
export const addSubsectionToSection = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const { sectionId, name } = req.body;

  if (!sectionId) {
    return errorResponse(res, 400, 'Section ID is required');
  }

  if (!name || !name.trim()) {
    return errorResponse(res, 400, 'Subsection name is required');
  }

  // Find menu
  const menu = await Menu.findOne({ restaurant: restaurantId });
  
  if (!menu) {
    return errorResponse(res, 404, 'Menu not found');
  }

  // Find section
  const section = menu.sections.find(s => s.id === sectionId);
  if (!section) {
    return errorResponse(res, 404, 'Section not found');
  }

  // Check if subsection with same name already exists
  const existingSubsection = section.subsections.find(
    sub => sub.name.toLowerCase().trim() === name.toLowerCase().trim()
  );

  if (existingSubsection) {
    return errorResponse(res, 400, 'Subsection with this name already exists');
  }

  // Create new subsection
  const newSubsection = {
    id: `subsection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    items: [],
  };

  section.subsections.push(newSubsection);
  await menu.save();

  return successResponse(res, 201, 'Subsection added successfully', {
    subsection: newSubsection,
    menu: {
      sections: menu.sections,
      isActive: menu.isActive,
    },
  });
});

// Add a new item to a subsection
export const addItemToSubsection = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const { sectionId, subsectionId, item } = req.body;

  if (!sectionId || !subsectionId) {
    return errorResponse(res, 400, 'Section ID and Subsection ID are required');
  }

  if (!item || !item.name || item.price === undefined) {
    return errorResponse(res, 400, 'Item name and price are required');
  }

  // Find menu
  const menu = await Menu.findOne({ restaurant: restaurantId });
  
  if (!menu) {
    return errorResponse(res, 404, 'Menu not found');
  }

  // Find section
  const section = menu.sections.find(s => s.id === sectionId);
  if (!section) {
    return errorResponse(res, 404, 'Section not found');
  }

  // Find subsection
  const subsection = section.subsections.find(sub => sub.id === subsectionId);
  if (!subsection) {
    return errorResponse(res, 404, 'Subsection not found');
  }

  // Normalize item data
  const basePrice = deriveBasePriceFromVariations(item.price, item.variations);
  const newItem = {
    id: String(item.id || Date.now() + Math.random()),
    name: item.name.trim(),
    nameArabic: item.nameArabic || "",
    image: item.image || "",
    category: item.category || section.name,
    rating: item.rating ?? 0.0,
    reviews: item.reviews ?? 0,
    price: basePrice,
    stock: item.stock || "Unlimited",
    discount: item.discount || null,
    originalPrice: item.originalPrice || null,
    foodType: item.foodType || "Non-Veg",
    availabilityTimeStart: item.availabilityTimeStart || "12:01 AM",
    availabilityTimeEnd: item.availabilityTimeEnd || "11:57 PM",
    description: item.description || "",
    discountType: item.discountType || "Percent",
    discountAmount: item.discountAmount ?? 0.0,
    isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
    isRecommended: item.isRecommended || false,
    variations: Array.isArray(item.variations) ? item.variations.map(v => ({
      id: String(v.id || Date.now() + Math.random()),
      name: v.name || "",
      price: Number(v.price) || 0,
      stock: v.stock || "Unlimited",
    })) : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
    nutrition: Array.isArray(item.nutrition) ? item.nutrition : [],
    allergies: Array.isArray(item.allergies) ? item.allergies : [],
    photoCount: item.photoCount ?? 1,
    gst: item.gst ?? 0,
    images: Array.isArray(item.images) && item.images.length > 0 
      ? item.images.filter(img => img && typeof img === 'string' && img.trim() !== '')
      : (item.image && item.image.trim() !== '' ? [item.image] : []),
    preparationTime: item.preparationTime || "",
    approvalStatus: 'pending', // New items require admin approval
    requestedAt: new Date(),
  };

  subsection.items.push(newItem);
  await menu.save();

  return successResponse(res, 201, 'Item added to subsection successfully', {
    item: newItem,
    menu: {
      sections: menu.sections,
      isActive: menu.isActive,
    },
  });
});

// Get menu by restaurant ID (public - for user module)
export const getMenuByRestaurantId = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Match dining/public slug resolution: do not require isActive on Restaurant
    // (getRestaurantBySlug can return inactive rows; menu must not 404 in that case)
    const restaurant = await Restaurant.findOne({
      $or: [
        { restaurantId: id },
        { slug: id },
        ...(mongoose.Types.ObjectId.isValid(id) && id.length === 24
          ? [{ _id: new mongoose.Types.ObjectId(id) }]
          : []),
      ],
    });

    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Prefer active menu document; fall back so slug-opened outlets still get data
    let menu = await Menu.findOne({
      restaurant: restaurant._id,
      isActive: true,
    });
    if (!menu) {
      menu = await Menu.findOne({ restaurant: restaurant._id });
    }

    if (!menu) {
      // Return empty menu if not found
      return successResponse(res, 200, 'Menu retrieved successfully', {
        menu: {
          sections: [],
          isActive: true,
        },
      });
    }
    // Filter menu for user side: only show enabled sections and available items
    const filteredSections = (menu.sections || [])
      .filter(section => {
        // Only show sections where isEnabled is not explicitly false
        // If isEnabled is undefined/null, treat as enabled (default true)
        const isEnabled = section.isEnabled !== false;
        if (!isEnabled) {
        }
        return isEnabled;
      })
      .map(section => {
        // Filter direct items - only show available AND approved items
        // Items where isAvailable is not explicitly false AND approvalStatus is 'approved' should be shown
        const availableItems = (section.items || []).filter(item => {
          const isAvailable = isItemAvailableForPublic(item);
          const isApproved = isPubliclyApproved(item);
          const shouldShow = isAvailable && isApproved;
          
          // Debug logging for filtered items
          if (!shouldShow) {
          }
          
          // Debug logging for preparationTime - log ALL items to see what's in the data
          if (shouldShow) {
          }
          
          return shouldShow;
        });
        
        // Filter subsections and their items
        const availableSubsections = (section.subsections || [])
          .map(subsection => {
            const availableSubsectionItems = (subsection.items || []).filter(item => {
              const isAvailable = isItemAvailableForPublic(item);
              const isApproved = isPubliclyApproved(item);
              const shouldShow = isAvailable && isApproved;
              
              // Debug logging for filtered items
              if (!shouldShow) {
              }
              
              // Debug logging for preparationTime - log ALL items to see what's in the data
              if (shouldShow) {
              }
              
              return shouldShow;
            });
            // Only include subsection if it has available items
            if (availableSubsectionItems.length > 0) {
              return {
                ...subsection,
                items: availableSubsectionItems,
              };
            }
            return null;
          })
          .filter(subsection => subsection !== null); // Remove null subsections
        
        // Include section if it has at least one available item OR at least one subsection with available items
        // This ensures category remains visible even if some items are unavailable
        if (availableItems.length > 0 || availableSubsections.length > 0) {
          return {
            ...section,
            name: section.name || "Unnamed Section", // Ensure name is always present
            items: availableItems,
            subsections: availableSubsections,
          };
        }
        // Return null only if section has no available items AND no subsections with available items
        return null;
      })
      .filter(section => section !== null); // Remove null sections (sections with no available items)
    const totalItems = filteredSections.reduce((sum, section) => {
      const sectionItems = (section.items || []).length;
      const subsectionItems = (section.subsections || []).reduce((subSum, sub) => subSum + (sub.items || []).length, 0);
      return sum + sectionItems + subsectionItems;
    }, 0);
    return successResponse(res, 200, 'Menu retrieved successfully', {
      menu: {
        sections: filteredSections,
        isActive: menu.isActive,
      },
    });
  } catch (error) {
    console.error('Error fetching menu by restaurant ID:', error);
    return errorResponse(res, 500, 'Failed to fetch menu');
  }
};

// Add a new add-on
export const addAddon = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const { name, description, price, image, images } = req.body;

  if (!name || !name.trim()) {
    return errorResponse(res, 400, 'Add-on name is required');
  }

  if (price === undefined || price === null || price < 0) {
    return errorResponse(res, 400, 'Add-on price is required and must be non-negative');
  }

  // Find or create menu
  let menu = await Menu.findOne({ restaurant: restaurantId });
  
  if (!menu) {
    menu = new Menu({
      restaurant: restaurantId,
      sections: [],
      addons: [],
      isActive: true,
    });
  }

  // Normalize images array
  const normalizedImages = Array.isArray(images) && images.length > 0
    ? images.filter(img => img && typeof img === 'string' && img.trim() !== '')
    : (image && image.trim() !== '' ? [image] : []);

  // Create new add-on
  const newAddon = {
    id: `addon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    description: description || '',
    price: Number(price) || 0,
    image: normalizedImages.length > 0 ? normalizedImages[0] : '',
    images: normalizedImages,
    isAvailable: true,
    approvalStatus: 'pending', // New add-ons require admin approval
    requestedAt: new Date(),
  };

  menu.addons.push(newAddon);
  await menu.save();

  return successResponse(res, 201, 'Add-on added successfully. Pending admin approval.', {
    addon: newAddon,
    menu: {
      addons: menu.addons,
      isActive: menu.isActive,
    },
  });
});

// Get add-ons for restaurant (filtered by approval status)
export const getAddons = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const { includePending = false } = req.query;

  // Find menu
  const menu = await Menu.findOne({ restaurant: restaurantId });
  
  if (!menu) {
    return successResponse(res, 200, 'No add-ons found', {
      addons: [],
    });
  }

  // Filter add-ons based on approval status
  let addons = menu.addons || [];
  
  if (!includePending) {
    // For restaurant view, show all add-ons (including pending for their reference)
    // For public view, only show approved add-ons
    addons = addons; // Show all for restaurant admin
  } else {
    // Show all add-ons including pending
    addons = addons;
  }

  return successResponse(res, 200, 'Add-ons retrieved successfully', {
    addons,
  });
});

// Get addons by restaurant ID (public - for user module)
export const getAddonsByRestaurantId = async (req, res) => {
  try {
    const { id } = req.params;
    // Find restaurant by ID, slug, or restaurantId - don't filter by isActive
    let restaurant = await Restaurant.findOne({
      $or: [
        { restaurantId: id },
        { slug: id },
        ...(mongoose.Types.ObjectId.isValid(id) && id.length === 24 
          ? [{ _id: new mongoose.Types.ObjectId(id) }] 
          : []),
      ],
    });

    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }
    // Find menu - don't filter by isActive, just get the menu
    const menu = await Menu.findOne({ 
      restaurant: restaurant._id,
    });

    if (!menu) {
      return successResponse(res, 200, 'No add-ons found', {
        addons: [],
      });
    }
    // Show all addons - no filtering (as per user request to show addons "kaise bhi")
    const allAddons = menu.addons || [];
    
    // Log all addons for debugging
    if (allAddons.length > 0) {
    } else {
    }

    return successResponse(res, 200, 'Add-ons retrieved successfully', {
      addons: allAddons,
    });
  } catch (error) {
    console.error('Error fetching addons by restaurant ID:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 500, 'Failed to fetch add-ons');
  }
};

// Update an add-on
export const updateAddon = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const { id } = req.params;
  const { name, description, price, image, images, isAvailable } = req.body;

  // Find menu
  const menu = await Menu.findOne({ restaurant: restaurantId });
  
  if (!menu) {
    return errorResponse(res, 404, 'Menu not found');
  }

  // Find add-on
  const addonIndex = menu.addons.findIndex(a => String(a.id) === String(id));
  if (addonIndex === -1) {
    return errorResponse(res, 404, 'Add-on not found');
  }

  const addon = menu.addons[addonIndex];

  // If isAvailable is provided, update it without requiring re-approval
  if (typeof isAvailable === 'boolean') {
    addon.isAvailable = isAvailable;
    menu.markModified(`addons.${addonIndex}`);
    menu.markModified('addons');
    await menu.save();

    return successResponse(res, 200, 'Add-on availability updated successfully', {
      addon: menu.addons[addonIndex],
      menu: {
        addons: menu.addons,
        isActive: menu.isActive,
      },
    });
  }

  // For other updates, require name and price
  if (!name || !name.trim()) {
    return errorResponse(res, 400, 'Add-on name is required');
  }

  if (price === undefined || price === null || price < 0) {
    return errorResponse(res, 400, 'Add-on price is required and must be non-negative');
  }

  // Normalize images array
  const normalizedImages = Array.isArray(images) && images.length > 0
    ? images.filter(img => img && typeof img === 'string' && img.trim() !== '')
    : (image && image.trim() !== '' ? [image] : []);

  // Update add-on (preserve approval status if already approved/rejected)
  addon.name = name.trim();
  addon.description = description || '';
  addon.price = Number(price) || 0;
  addon.image = normalizedImages.length > 0 ? normalizedImages[0] : '';
  addon.images = normalizedImages;

  // If editing an approved/rejected add-on, set status back to pending for re-approval
  if (addon.approvalStatus === 'approved' || addon.approvalStatus === 'rejected') {
    addon.approvalStatus = 'pending';
    addon.requestedAt = new Date();
    addon.approvedAt = null;
    addon.approvedBy = null;
    addon.rejectedAt = null;
    addon.rejectionReason = '';
  }

  menu.markModified(`addons.${addonIndex}`);
  menu.markModified('addons');
  await menu.save();

  return successResponse(res, 200, 'Add-on updated successfully. Pending admin approval if previously approved.', {
    addon: menu.addons[addonIndex],
    menu: {
      addons: menu.addons,
      isActive: menu.isActive,
    },
  });
});

// Delete an add-on
export const deleteAddon = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const { id } = req.params;

  // Find menu
  const menu = await Menu.findOne({ restaurant: restaurantId });
  
  if (!menu) {
    return errorResponse(res, 404, 'Menu not found');
  }

  // Find and remove add-on
  const addonIndex = menu.addons.findIndex(a => String(a.id) === String(id));
  if (addonIndex === -1) {
    return errorResponse(res, 404, 'Add-on not found');
  }

  menu.addons.splice(addonIndex, 1);
  menu.markModified('addons');
  await menu.save();

  return successResponse(res, 200, 'Add-on deleted successfully', {
    menu: {
      addons: menu.addons,
      isActive: menu.isActive,
    },
  });
});

