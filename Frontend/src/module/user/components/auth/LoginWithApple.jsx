import React from 'react';
import AppleLogin from 'react-apple-login';

const LoginWithApple = ({ clientId, redirectURI, isLoading, state = "user" }) => {
  const handleLogin = () => {
    if (isLoading) return;
    
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
    
    if (state === "restaurant") {
       // Using apiBaseUrl to hit the correct backend environment
       window.open(`${apiBaseUrl}/auth/apple/start?role=restaurant`, "_self");
       return;
    }

    const finalClientId = clientId || "com.tifunbox.web";
    // Construct redirect URI naturally based on apiBaseUrl
    const finalRedirectURI = redirectURI || `${apiBaseUrl}/auth/apple/callback`;
    
    // Construct Apple Auth URL
    const authUrl = `https://appleid.apple.com/auth/authorize?` + 
      `client_id=${finalClientId}&` +
      `redirect_uri=${encodeURIComponent(finalRedirectURI)}&` +
      `response_type=code&` +
      `response_mode=form_post&` +
      `state=${state}&` +
      `role=${state}`;

    // Open popup
    const width = 600;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    window.open(
      authUrl,
      "Apple Login",
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  return (
    <button
      onClick={handleLogin}
      disabled={isLoading}
      className="w-full h-12 rounded-lg border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-900 font-semibold text-base flex items-center justify-center gap-3 transition-colors bg-white px-4"
      style={{ opacity: isLoading ? 0.7 : 1 }}
    >
      <svg className="w-5 h-5 mr-auto text-black" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.674.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
      </svg>
      <span className="mr-auto text-gray-900">
        {isLoading ? "Please wait..." : "Login with Apple"}
      </span>
    </button>
  );
};

export default LoginWithApple;
