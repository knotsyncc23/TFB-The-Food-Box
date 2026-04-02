/**
 * Route Calculation Service
 * Uses Dijkstra's algorithm for route calculation
 * Falls back to OSRM API for real-world routing
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

/**
 * Simple Dijkstra's algorithm implementation for route calculation
 * This is a simplified version - for production, use OSRM or Google Maps API
 * @param {Array} nodes - Array of {lat, lng, id} nodes
 * @param {Array} edges - Array of {from, to, weight} edges
 * @param {string} startId - Starting node ID
 * @param {string} endId - Ending node ID
 * @returns {Object} {path: [nodeIds], distance: number}
 */
function dijkstra(nodes, edges, startId, endId) {
  const distances = {};
  const previous = {};
  const unvisited = new Set(nodes.map(n => n.id));
  
  // Initialize distances
  nodes.forEach(node => {
    distances[node.id] = node.id === startId ? 0 : Infinity;
  });
  
  while (unvisited.size > 0) {
    // Find unvisited node with smallest distance
    let current = null;
    let minDistance = Infinity;
    
    for (const nodeId of unvisited) {
      if (distances[nodeId] < minDistance) {
        minDistance = distances[nodeId];
        current = nodeId;
      }
    }
    
    if (current === null || distances[current] === Infinity) {
      break; // No path found
    }
    
    if (current === endId) {
      // Reconstruct path
      const path = [];
      let node = endId;
      while (node !== undefined) {
        path.unshift(node);
        node = previous[node];
      }
      return { path, distance: distances[endId] };
    }
    
    unvisited.delete(current);
    
    // Update distances to neighbors
    const neighbors = edges.filter(e => e.from === current);
    for (const edge of neighbors) {
      const alt = distances[current] + edge.weight;
      if (alt < distances[edge.to]) {
        distances[edge.to] = alt;
        previous[edge.to] = current;
      }
    }
  }
  
  return { path: [], distance: Infinity };
}

/**
 * Calculate route using OSRM API (recommended for production)
 * @param {number} startLat - Starting latitude
 * @param {number} startLng - Starting longitude
 * @param {number} endLat - Ending latitude
 * @param {number} endLng - Ending longitude
 * @returns {Promise<Object>} {coordinates: [[lat, lng]], distance: number, duration: number}
 */
export async function calculateRouteOSRM(startLat, startLng, endLat, endLng) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeoutMs = 8000; // Keep backend responsive; fallback to haversine on slow OSRM
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]); // Convert [lng, lat] to [lat, lng]
      const distance = route.distance / 1000; // Convert meters to kilometers
      const duration = route.duration / 60; // Convert seconds to minutes
      
      return {
        success: true,
        coordinates,
        distance,
        duration,
        method: 'osrm'
      };
    } else {
      // Fallback to straight line
      const distance = haversineDistance(startLat, startLng, endLat, endLng);
      return {
        success: true,
        coordinates: [[startLat, startLng], [endLat, endLng]],
        distance,
        duration: (distance / 30) * 60, // Assume 30 km/h average speed
        method: 'haversine'
      };
    }
  } catch (error) {
    console.error('Error calculating route with OSRM:', error);
    // Fallback to straight line
    const distance = haversineDistance(startLat, startLng, endLat, endLng);
    return {
      success: true,
      coordinates: [[startLat, startLng], [endLat, endLng]],
      distance,
      duration: (distance / 30) * 60,
      method: 'haversine_fallback'
    };
  }
}

/**
 * Calculate route using Dijkstra's algorithm (for custom routing)
 * This creates intermediate waypoints and calculates optimal path
 * @param {number} startLat - Starting latitude
 * @param {number} startLng - Starting longitude
 * @param {number} endLat - Ending latitude
 * @param {number} endLng - Ending longitude
 * @param {Array} waypoints - Optional intermediate waypoints [{lat, lng}]
 * @returns {Promise<Object>} {coordinates: [[lat, lng]], distance: number, duration: number}
 */
export async function calculateRouteDijkstra(startLat, startLng, endLat, endLng, waypoints = []) {
  try {
    // Create nodes
    const nodes = [
      { id: 'start', lat: startLat, lng: startLng },
      ...waypoints.map((wp, i) => ({ id: `wp${i}`, lat: wp.lat, lng: wp.lng })),
      { id: 'end', lat: endLat, lng: endLng }
    ];
    
    // Create edges with weights (distances)
    const edges = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const distance = haversineDistance(
          nodes[i].lat, nodes[i].lng,
          nodes[j].lat, nodes[j].lng
        );
        edges.push({
          from: nodes[i].id,
          to: nodes[j].id,
          weight: distance
        });
      }
    }
    
    // Calculate shortest path
    const result = dijkstra(nodes, edges, 'start', 'end');
    
    // Convert path to coordinates
    const coordinates = result.path.map(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      return [node.lat, node.lng];
    });
    
    return {
      success: true,
      coordinates,
      distance: result.distance,
      duration: (result.distance / 30) * 60, // Assume 30 km/h average speed
      method: 'dijkstra'
    };
  } catch (error) {
    console.error('Error calculating route with Dijkstra:', error);
    // Fallback to straight line
    const distance = haversineDistance(startLat, startLng, endLat, endLng);
    return {
      success: true,
      coordinates: [[startLat, startLng], [endLat, endLng]],
      distance,
      duration: (distance / 30) * 60,
      method: 'haversine_fallback'
    };
  }
}

/**
 * Main route calculation function
 * Uses OSRM by default, falls back to Dijkstra if needed
 * @param {number} startLat - Starting latitude
 * @param {number} startLng - Starting longitude
 * @param {number} endLat - Ending latitude
 * @param {number} endLng - Ending longitude
 * @param {Object} options - {useDijkstra: boolean, waypoints: Array}
 * @returns {Promise<Object>} Route data
 */
export async function calculateRoute(startLat, startLng, endLat, endLng, options = {}) {
  const { useDijkstra = false, waypoints = [] } = options;
  
  if (useDijkstra && waypoints.length > 0) {
    return await calculateRouteDijkstra(startLat, startLng, endLat, endLng, waypoints);
  } else {
    return await calculateRouteOSRM(startLat, startLng, endLat, endLng);
  }
}
