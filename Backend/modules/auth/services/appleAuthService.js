import axios from "axios";
import jwt from "jsonwebtoken";
import jwkToPem from "jwk-to-pem";
import winston from "winston";
import qs from "qs";
import { getEnvVar } from "../../../shared/utils/envService.js";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

class AppleAuthService {
  constructor() {
    this.keys = [];
    this.lastFetched = 0;
    this.cacheTtlMs = 1000 * 60 * 60 * 6; // Cache keys for 6 hours
    this.keysUrl = "https://appleid.apple.com/auth/keys";
    this.tokenUrl = "https://appleid.apple.com/auth/token";
  }

  async ensureKeys() {
    const now = Date.now();
    if (this.keys.length === 0 || now - this.lastFetched > this.cacheTtlMs) {
      await this.fetchKeys();
    }
  }

  async fetchKeys() {
    try {
      const response = await axios.get(this.keysUrl, { timeout: 5000 });
      if (!response?.data?.keys || !Array.isArray(response.data.keys)) {
        throw new Error("Apple keys payload is malformed");
      }
      this.keys = response.data.keys;
      this.lastFetched = Date.now();
      logger.info("Fetched Apple identity keys", {
        keyCount: this.keys.length,
      });
    } catch (error) {
      logger.error("Failed to fetch Apple identity keys", {
        message: error.message,
      });
      throw new Error("Unable to load Apple identity keys");
    }
  }

  async getKey(kid) {
    await this.ensureKeys();
    let key = this.keys.find((item) => item.kid === kid);
    if (!key) {
      // Retry once in case Apple rotated keys mid-flight
      await this.fetchKeys();
      key = this.keys.find((item) => item.kid === kid);
    }
    return key;
  }

  /**
   * Generates a signed JWT client_secret for Apple OAuth
   */
  async getClientSecret() {
    const teamId = (await getEnvVar("APPLE_TEAM_ID") || process.env.APPLE_TEAM_ID || "").toString().trim().replace(/^"|"$/g, "");
    const keyId = (await getEnvVar("APPLE_KEY_ID") || process.env.APPLE_KEY_ID || "").toString().trim().replace(/^"|"$/g, "");
    const clientId = (await getEnvVar("APPLE_CLIENT_ID") || process.env.APPLE_CLIENT_ID || "").toString().trim().replace(/^"|"$/g, "");
    
    // Improved private key parsing for asymmetric key detection
    const rawPrivateKey = (await getEnvVar("APPLE_PRIVATE_KEY") || process.env.APPLE_PRIVATE_KEY || "").toString();
    const privateKey = rawPrivateKey
      .trim()
      .replace(/^"|"$/g, "") // Remove potential outer double quotes
      .replace(/\\n/g, "\n"); // Replace literal \n with actual newlines

    console.log("PRIVATE KEY:", privateKey);

    if (!teamId || !keyId || !clientId || !privateKey) {
      logger.error("Apple Auth configuration missing", { 
        teamId: !!teamId, 
        keyId: !!keyId, 
        clientId: !!clientId, 
        privateKey: !!privateKey 
      });
      throw new Error("Apple Auth environment variables are not properly configured");
    }

    const payload = {
      iss: teamId,
      iat: Math.floor(Date.now() / 1000) - 60, // 60 seconds in the past for clock drift
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour (Apple allows up to 6 months, but 1 hour is safer)
      aud: "https://appleid.apple.com",
      sub: clientId,
    };

    return jwt.sign(payload, privateKey, {
      algorithm: "ES256",
      header: {
        alg: "ES256",
        kid: keyId,
      },
    });
  }

  /**
   * Exchanges authorization code for Apple tokens (id_token, access_token, refresh_token)
   */
  async exchangeCode(code, redirectUri) {
    const clientId = (await getEnvVar("APPLE_CLIENT_ID") || process.env.APPLE_CLIENT_ID || "").toString().trim().replace(/^"|"$/g, "");
    const clientSecret = await this.getClientSecret();
    const finalRedirectUri = (redirectUri || await getEnvVar("APPLE_REDIRECT_URI") || process.env.APPLE_REDIRECT_URI || "").toString().trim().replace(/^"|"$/g, "");

    logger.info("Sending code exchange request to Apple", { 
      clientId, 
      redirectUri: finalRedirectUri, 
      hasClientSecret: !!clientSecret,
      code: code ? code.substring(0, 10) + '...' : null 
    });

    try {
      const response = await axios.post(this.tokenUrl, qs.stringify(data), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      logger.info("Apple code exchange successful", { hasIdToken: !!response.data.id_token });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error_description || error.response?.data?.error || error.message;
      logger.error("Apple code exchange failed", {
        message: errorMessage,
        error: error.response?.data,
      });
      throw new Error(`Apple code exchange failed: ${errorMessage}`);
    }
  }

  async verifyIdentityToken(identityToken, audience) {
    if (!identityToken) {
      throw new Error("Identity token is required");
    }

    const clientId = (audience || await getEnvVar("APPLE_CLIENT_ID") || process.env.APPLE_CLIENT_ID || "").toString().trim().replace(/^"|"$/g, "");
    if (!clientId) {
      throw new Error("Audience (clientId) is required for Apple verification");
    }

    const decoded = jwt.decode(identityToken, { complete: true });
    const kid = decoded?.header?.kid;
    if (!kid) {
      throw new Error("Identity token header is missing key id (kid)");
    }

    const key = await this.getKey(kid);
    if (!key) {
      throw new Error("Unable to find Apple public key for token");
    }

    const publicKey = jwkToPem(key);
    logger.info("Public key generated for kid", { kid });
    try {
      const verified = jwt.verify(identityToken, publicKey, {
        issuer: "https://appleid.apple.com",
        audience: clientId,
        algorithms: ["RS256"],
      });
      logger.info("Apple identity token verified successfully", { sub: verified.sub });
      return verified;
    } catch (error) {
      logger.error("Apple identity token verification failed", {
        message: error.message,
        kid,
      });
      throw new Error("Apple identity token could not be verified");
    }
  }
}

export default new AppleAuthService();
