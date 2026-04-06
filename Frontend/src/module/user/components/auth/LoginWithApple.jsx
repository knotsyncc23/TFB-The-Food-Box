import React from 'react';
import AppleLogin from 'react-apple-login';

const LoginWithApple = ({ clientId, redirectURI, isLoading }) => {
  // Config check karein
  if (!clientId || !redirectURI) return null;

  return (
    <div className="apple-login-container" style={{ opacity: isLoading ? 0.6 : 1, pointerEvents: isLoading ? 'none' : 'auto' }}>
      <AppleLogin
        clientId={clientId} // Use dynamic clientId from props
        redirectURI={redirectURI} // Use dynamic redirectURI from props
        responseType="code"
        responseMode="form_post"
        usePopup={false} // Set to true to avoid popup blocked and allow postMessage
        designProp={{
          height: 30,
          width: 140,
          color: "black",
          border: false,
          type: "sign-in",
          border_radius: 15,
          scale: 1,
          locale: "en_US",
        }}
      />
    </div>
  );
};

export default LoginWithApple;
