/**
 * Centralized email validation utility
 * Ensures consistent email format validation across the entire application.
 * Format: aaa@gmail.com (standard email with @ and domain)
 */

/**
 * Email regex pattern for validation
 * Matches: aaa@gmail.com, user123@example.co.uk, etc.
 * Format: [any chars except space/@]@[any chars except space/@].[any chars except space/@]
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|net|org|edu|gov|mil|biz|info|name|museum|co\.in|in|co|us|me|io|uk)$/i;

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {string} - Empty string if valid, error message if invalid
 */
export const validateEmail = (email) => {
  if (!email) return "";
  
  const trimmedEmail = String(email).trim();
  
  if (!trimmedEmail) {
    return "Email is required";
  }
  
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return "Please enter a valid email address (e.g., aaa@gmail.com)";
  }
  
  return "";
};

/**
 * Check if email is valid (returns boolean)
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid, false if invalid
 */
export const isValidEmail = (email) => {
  if (!email) return false;
  const trimmedEmail = String(email).trim();
  return EMAIL_REGEX.test(trimmedEmail);
};
