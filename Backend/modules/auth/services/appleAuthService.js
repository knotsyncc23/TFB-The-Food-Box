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
    const privateKey = process.env.APPLE_PRIVATE_KEY
      ?.trim()
      .replace(/^"|"$/g, "") // Remove potential outer double quotes
      .replace(/\\n/g, "\n"); // Replace literal \n with actual newlines

    if (!privateKey || !privateKey.includes("BEGIN PRIVATE KEY")) {
      logger.error("❌ Apple private key missing or invalid");
      throw new Error("❌ Apple private key missing or invalid");
    }

    try {
      const token = jwt.sign({}, privateKey, {
        algorithm: "ES256",
        expiresIn: "1h",
        issuer: process.env.APPLE_TEAM_ID,
        audience: "https://appleid.apple.com",
        subject: process.env.APPLE_CLIENT_ID,
        keyid: process.env.APPLE_KEY_ID,
      });

      console.log("✅ Apple Client Secret Generated");
      return token;
    } catch (error) {
      logger.error("Failed to sign Apple Client Secret", { message: error.message });
      throw error;
    }
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
