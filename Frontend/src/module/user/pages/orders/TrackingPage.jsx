import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { ArrowLeft, Share2, RefreshCcw, Home, UtensilsCrossed, ChevronRight, Shield, Phone } from 'lucide-react';

// --- 1. Google Map Styles (Light Theme - as shown in image) ---
const lightMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#333333" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#666666" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#666666" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#e5e5e5" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e0e0e0" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#f0f0f0" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#e3f2fd" }],
  },
];

const containerStyle = {
  width: '100%',
  height: '100vh',
};

// Coordinates (Example: Indore locations)
const restaurantPos = { lat: 22.7196, lng: 75.8577 };
const userPos = { lat: 22.75, lng: 75.89 };
const center = { lat: 22.735, lng: 75.875 };

const TrackingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-gray-900 font-sans overflow-hidden">
      
      {/* --- 2. Floating Header (Green) --- */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-[#23633F] p-4 pt-4 rounded-b-2xl shadow-lg">
        <div className="flex items-center justify-between text-white mb-3">
          <ArrowLeft className="w-6 h-6 cursor-pointer" />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">Sagar Restaurant</span>
          </div>
          <Share2 className="w-5 h-5 cursor-pointer" />
        </div>
        
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-3">Order placed</h2>
          <div className="flex items-center justify-center gap-2 bg-[#1a4d31] w-fit mx-auto px-4 py-2 rounded-full">
            <span className="text-sm font-medium">Food preparation will begin shortly</span>
            <RefreshCcw className="w-4 h-4 text-red-200" />
          </div>
        </div>
      </div>

      {/* --- 3. Google Map Background --- */}
      <div className="absolute top-0 left-0 w-full h-full z-0">
        <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_API_KEY"}> 
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={13}
            options={{
              styles: lightMapStyle,
              disableDefaultUI: true,
              zoomControl: false,
            }}
          >
            {/* Markers */}
            <Marker 
              position={restaurantPos} 
              icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/restaurant.png",
                scaledSize: new window.google.maps.Size(40, 40)
              }}
            />
            <Marker 
              position={userPos} 
              icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/homegardenbusiness.png",
                scaledSize: new window.google.maps.Size(40, 40)
              }}
            />
            {/* Dotted Polyline */}
            <Polyline
              path={[restaurantPos, userPos]}
              options={{
                strokeColor: "#23633F",
                strokeOpacity: 0.8,
                strokeWeight: 3,
                icons: [{
                  icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 },
                  offset: "0",
                  repeat: "20px",
                }],
              }}
            />
          </GoogleMap>
        </LoadScript>

        {/* Map Overlay - Arrival Time Card */}
        <div className="absolute bottom-[50vh] left-4 right-4 z-10 bg-white rounded-xl p-4 shadow-lg border border-gray-200">
          <p className="text-xs text-gray-600 mb-1 uppercase">ARRIVING IN</p>
          <p className="text-3xl font-bold text-red-600 mb-1">80 mins</p>
          <p className="text-sm text-gray-600 mb-2">45.1 km away</p>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#23633F] rounded-full" style={{ width: '60%' }}></div>
          </div>
        </div>
      </div>

      {/* --- 4. Bottom Sheet (Dark Overlay) - Scrollable Content --- */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-[#141414] rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.5)] max-h-[50vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          {/* Food Cooking Status Card */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center">
                <UtensilsCrossed className="w-6 h-6 text-red-400" />
              </div>
              <p className="font-semibold text-white">Food is Cooking</p>
            </div>
          </div>

          {/* Delivery Partner Safety Card */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-gray-400" />
              <span className="flex-1 text-left font-medium text-white">
                Learn about delivery partner safety
              </span>
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </div>
          </div>

          {/* Delivery Details Banner */}
          <div className="bg-yellow-900/30 rounded-xl p-4 border border-yellow-800/50">
            <p className="text-yellow-300 font-medium text-center">
              All your delivery details in one place 👋
            </p>
          </div>

          {/* Contact Person Card - click to go to profile */}
          <button
            type="button"
            onClick={() => navigate('/user/profile')}
            className="w-full text-left bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm hover:bg-gray-700/80 active:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">Ajay Panchal</p>
                <p className="text-sm text-gray-400">+91 7610416911</p>
              </div>
            </div>
          </button>

          {/* Delivery Location Card */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <Home className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="font-semibold text-white">Delivery at Location</p>
                <p className="text-sm text-gray-400">X2RJ+QHR, Dewas, Madhya Pradesh 45...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;

