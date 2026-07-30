/**
 * Configuration management utility for EduStock application
 * Manages application settings persisted in LocalStorage
 */

const STORAGE_KEY = "edustock:config";
export const CONFIG_CHANGED_EVENT = "edustock:config-changed";

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  useMock: false,
  validityAlertDays: 30,
  cardDensity: "confortavel"
};

/**
 * Valid values for cardDensity setting
 */
const VALID_CARD_DENSITIES = ["confortavel", "compacto", "denso"];

/**
 * Validates a configuration object structure
 * @param {Object} config - Configuration object to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidConfig(config) {
  if (!config || typeof config !== "object") {
    return false;
  }

  // Validate useMock
  if (config.useMock !== undefined && typeof config.useMock !== "boolean") {
    return false;
  }

  // Validate validityAlertDays
  if (config.validityAlertDays !== undefined) {
    if (typeof config.validityAlertDays !== "number" || 
        config.validityAlertDays <= 0 || 
        !Number.isInteger(config.validityAlertDays)) {
      return false;
    }
  }

  // Validate cardDensity
  if (config.cardDensity !== undefined &&
      !VALID_CARD_DENSITIES.includes(config.cardDensity)) {
    return false;
  }

  return true;
}

/**
 * Reads and validates configuration from LocalStorage
 * @returns {Object} Configuration object (merged with defaults if necessary)
 */
export function getConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    
    // If key doesn't exist, return default config
    if (!stored) {
      return { ...DEFAULT_CONFIG };
    }

    // Parse stored JSON
    const parsed = JSON.parse(stored);
    
    // Validate structure
    if (!isValidConfig(parsed)) {
      console.warn("Invalid config in localStorage, using defaults");
      return { ...DEFAULT_CONFIG };
    }

    // Merge with defaults to ensure all keys exist
    return {
      ...DEFAULT_CONFIG,
      ...parsed
    };
  } catch (error) {
    // If JSON parsing fails or any other error, return defaults
    console.error("Error reading config from localStorage:", error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Merges updates with existing configuration and persists to LocalStorage
 * @param {Object} updates - Partial configuration object with values to update
 * @returns {Object} The new merged configuration
 */
export function setConfig(updates) {
  // Read current config
  const current = getConfig();
  
  // Merge updates
  const merged = {
    ...current,
    ...updates
  };

  // Validate merged config
  if (!isValidConfig(merged)) {
    throw new Error("Invalid configuration values");
  }

  // Persist to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(CONFIG_CHANGED_EVENT, { detail: merged })
      );
    }
  } catch (error) {
    console.error("Error saving config to localStorage:", error);
    throw error;
  }

  return merged;
}
