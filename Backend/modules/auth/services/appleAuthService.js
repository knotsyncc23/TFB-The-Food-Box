import axios from "axios";
import jwt from "jsonwebtoken";
import jwkToPem from "jwk-to-pem";
import winston from "winston";

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

  async verifyIdentityToken(identityToken, audience) {
    if (!identityToken) {
      throw new Error("Identity token is required");
    }
    if (!audience) {
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
    try {
      return jwt.verify(identityToken, publicKey, {
        issuer: "https://appleid.apple.com",
        audience,
        algorithms: ["RS256"],
      });
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
