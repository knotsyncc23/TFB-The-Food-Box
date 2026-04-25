import { z } from "zod";
import { ValidationError } from "../../core/auth/errors.js";

const schema = z.object({
  idToken: z.string().min(1, "Google ID token is required"),
  fcmToken: z.string().optional(),
  platform: z.enum(["web", "mobile"]).optional(),
});

export const validateUserGoogleLoginDto = (body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.errors[0].message);
  }
  return result.data;
};
