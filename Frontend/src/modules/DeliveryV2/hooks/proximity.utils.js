/**
 * Haversine formula to calculate the great-circle distance between two points on a sphere.
 * Returns distance in METERS.
 * 
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  
  const R = 6371e3; // Earth radius in meters
  const Ï†1 = (lat1 * Math.PI) / 180;
  const Ï†2 = (lat2 * Math.PI) / 180;
  const Î”Ï† = ((lat2 - lat1) * Math.PI) / 180;
  const Î”Î» = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Î”Ï† / 2) * Math.sin(Î”Ï† / 2) +
    Math.cos(Ï†1) * Math.cos(Ï†2) * Math.sin(Î”Î» / 2) * Math.sin(Î”Î» / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};
