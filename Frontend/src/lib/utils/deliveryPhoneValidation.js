/**
 * Shared validation for delivery sign-in / sign-up phone entry by country code.
 * Digits only are counted (national number); leading 0 may be included in digit count.
 */

const INDIA = "+91"

/** [minDigits, maxDigits] inclusive for national number length */
const DIGIT_BOUNDS = {
  "+1": [10, 10],
  "+44": [10, 11],
  [INDIA]: [10, 10],
  "+86": [11, 11],
  "+81": [10, 11],
  "+49": [10, 12],
  "+33": [9, 9],
  "+39": [9, 11],
  "+34": [9, 9],
  "+61": [9, 9],
  "+7": [10, 10],
  "+55": [10, 11],
  "+52": [10, 10],
  "+82": [9, 11],
  "+65": [8, 8],
  "+971": [9, 9],
  "+966": [9, 9],
  "+27": [9, 9],
  "+31": [9, 9],
  "+46": [9, 9],
}

export function validateDeliveryPhone(phone, countryCode) {
  if (!phone || String(phone).trim() === "") {
    return "Phone number is required"
  }

  const digitsOnly = String(phone).replace(/\D/g, "")

  if (countryCode === INDIA) {
    if (digitsOnly.length !== 10) {
      return "Indian phone number must be 10 digits"
    }
    const first = digitsOnly[0]
    if (!["6", "7", "8", "9"].includes(first)) {
      return "Invalid Indian mobile number"
    }
    return ""
  }

  const bounds = DIGIT_BOUNDS[countryCode] || [8, 15]
  const [min, max] = bounds
  if (digitsOnly.length < min || digitsOnly.length > max) {
    if (min === max) {
      return `Phone number must be ${min} digits for this country`
    }
    return `Phone number must be ${min}-${max} digits for this country`
  }

  return ""
}
