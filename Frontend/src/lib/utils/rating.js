const clampRating = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return Number(Math.min(5, Math.max(0, value)).toFixed(1));
};

const normalizeRawRating = (rawRating) => {
  if (rawRating === null || rawRating === undefined) {
    return null;
  }

  const parsed = typeof rawRating === "number" ? rawRating : Number(rawRating);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }

  const converted = parsed > 5 ? parsed / 2 : parsed;
  return clampRating(converted);
};

const normalizeObjectRatings = (payload) => {
  if (!payload || typeof payload !== "object") {
    return;
  }

  if (Array.isArray(payload)) {
    payload.forEach((item) => normalizeObjectRatings(item));
    return;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "rating")) {
    payload.rating = normalizeRawRating(payload.rating);
  }

  Object.values(payload).forEach((value) => {
    if (Array.isArray(value) || (value && typeof value === "object")) {
      normalizeObjectRatings(value);
    }
  });
};

export { normalizeRawRating, normalizeObjectRatings };
