const { parsePhoneNumber, isValidPhoneNumber, getCountryCallingCode, AsYouType } = require('libphonenumber-js');

/**
 * Phone Number Validator and Formatter
 * Validates and formats phone numbers based on country code
 */
class PhoneValidator {
  /**
   * Validate and format phone number for WhatsApp
   * @param {string} phoneNumber - Raw phone number
   * @param {string} countryCode - ISO country code (e.g., 'US', 'MA', 'FR')
   * @returns {Object} - { isValid: boolean, formatted: string, error: string }
   */
  static validateAndFormat(phoneNumber, countryCode = null) {
    if (!phoneNumber || !phoneNumber.trim()) {
      return {
        isValid: false,
        formatted: null,
        error: 'Phone number is empty'
      };
    }

    const cleanedPhone = phoneNumber.trim();
    
    try {
      // Strategy 1: If country code is provided, try parsing as national number first
      if (countryCode) {
        const upperCountry = countryCode.toUpperCase();
        
        // Try parsing as national number with country code
        try {
          const phoneNumberObj = parsePhoneNumber(cleanedPhone, upperCountry);
          
          if (phoneNumberObj && phoneNumberObj.isValid()) {
            const international = phoneNumberObj.format('E.164').replace('+', '');
            
            return {
              isValid: true,
              formatted: international,
              country: phoneNumberObj.country,
              countryCallingCode: phoneNumberObj.countryCallingCode,
              nationalNumber: phoneNumberObj.nationalNumber,
              original: cleanedPhone
            };
          }
        } catch (e) {
          // If parsing with country fails, continue to other strategies
        }
      }
      
      // Strategy 2: Try parsing as international number (auto-detect country from number)
      try {
        const phoneNumberObj = parsePhoneNumber(cleanedPhone);
        
        if (phoneNumberObj && phoneNumberObj.isValid()) {
          // If country was provided, verify it matches
          if (countryCode && phoneNumberObj.country !== countryCode.toUpperCase()) {
            // Country mismatch - try again with provided country as default
            try {
              const phoneWithCountry = parsePhoneNumber(cleanedPhone, countryCode.toUpperCase());
              if (phoneWithCountry && phoneWithCountry.isValid()) {
                const international = phoneWithCountry.format('E.164').replace('+', '');
                return {
                  isValid: true,
                  formatted: international,
                  country: phoneWithCountry.country,
                  countryCallingCode: phoneWithCountry.countryCallingCode,
                  nationalNumber: phoneWithCountry.nationalNumber,
                  original: cleanedPhone
                };
              }
            } catch (e) {
              // Continue with originally parsed number
            }
          }
          
          const international = phoneNumberObj.format('E.164').replace('+', '');
          
          return {
            isValid: true,
            formatted: international,
            country: phoneNumberObj.country,
            countryCallingCode: phoneNumberObj.countryCallingCode,
            nationalNumber: phoneNumberObj.nationalNumber,
            original: cleanedPhone
          };
        }
      } catch (e) {
        // If international parsing fails, continue to country-specific parsing
      }
      
      // Strategy 3: Try using AsYouType formatter to handle incomplete/partial numbers
      if (countryCode) {
        try {
          const formatter = new AsYouType(countryCode.toUpperCase());
          const formatted = formatter.input(cleanedPhone);
          
          if (formatter.isValid()) {
            const phoneNumberObj = parsePhoneNumber(formatted, countryCode.toUpperCase());
            if (phoneNumberObj && phoneNumberObj.isValid()) {
              const international = phoneNumberObj.format('E.164').replace('+', '');
              return {
                isValid: true,
                formatted: international,
                country: phoneNumberObj.country,
                countryCallingCode: phoneNumberObj.countryCallingCode,
                nationalNumber: phoneNumberObj.nationalNumber,
                original: cleanedPhone
              };
            }
          }
        } catch (e) {
          // AsYouType parsing failed
        }
      }
      
      // If all parsing attempts failed
      const errorMsg = countryCode 
        ? `Invalid phone number format for ${countryCode}. Expected format: national number (e.g., 0655927999) or international (e.g., +212655927999).`
        : 'Invalid phone number format. Please include country code (e.g., +1234567890)';
      
      return {
        isValid: false,
        formatted: null,
        error: errorMsg,
        original: cleanedPhone,
        country: countryCode
      };
    } catch (error) {
      return {
        isValid: false,
        formatted: null,
        error: error.message || 'Failed to validate phone number',
        original: cleanedPhone,
        country: countryCode
      };
    }
  }

  /**
   * Get country code from WooCommerce order
   * @param {Object} order - WooCommerce order object
   * @returns {string} - ISO country code (e.g., 'US', 'MA', 'FR')
   */
  static getCountryFromOrder(order) {
    // Try billing country first
    if (order?.billing?.country) {
      return order.billing.country.toUpperCase();
    }
    
    // Try shipping country
    if (order?.shipping?.country) {
      return order.shipping.country.toUpperCase();
    }
    
    // Default to US if no country found
    return 'US';
  }

  /**
   * Format phone number for WhatsApp (@c.us format)
   * @param {string} validatedNumber - Validated international number (without +)
   * @returns {string} - Phone number with @c.us suffix
   */
  static formatForWhatsApp(validatedNumber) {
    if (!validatedNumber) return null;
    
    // Remove + if present
    const cleaned = validatedNumber.replace(/^\+/, '');
    
    // Add @c.us suffix if not already present
    if (cleaned.includes('@c.us') || cleaned.includes('@g.us')) {
      return cleaned;
    }
    
    return `${cleaned}@c.us`;
  }

  /**
   * Validate phone number for a specific country
   * @param {string} phoneNumber - Phone number to validate
   * @param {string} countryCode - ISO country code
   * @returns {boolean} - Is valid
   */
  static isValidForCountry(phoneNumber, countryCode) {
    try {
      return isValidPhoneNumber(phoneNumber, countryCode.toUpperCase());
    } catch (error) {
      return false;
    }
  }
}

module.exports = PhoneValidator;

