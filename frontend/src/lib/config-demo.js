/**
 * Demo script to show config.js functionality
 * Run with: node src/lib/config-demo.js
 */

import { DEFAULT_CONFIG, getConfig, setConfig } from "./config.js";

console.log("=== EduStock Config Utility Demo ===\n");

// 1. Show defaults
console.log("1. DEFAULT_CONFIG:");
console.log(JSON.stringify(DEFAULT_CONFIG, null, 2));

// 2. Get config (should return defaults when empty)
console.log("\n2. getConfig() - first call (no localStorage yet):");
const initialConfig = getConfig();
console.log(JSON.stringify(initialConfig, null, 2));

// 3. Set some values
console.log("\n3. setConfig({ useMock: true, validityAlertDays: 45 }):");
const updatedConfig = setConfig({ useMock: true, validityAlertDays: 45 });
console.log(JSON.stringify(updatedConfig, null, 2));

// 4. Get config again (should return persisted values)
console.log("\n4. getConfig() - after setConfig:");
const persistedConfig = getConfig();
console.log(JSON.stringify(persistedConfig, null, 2));

// 5. Update one value
console.log("\n5. setConfig({ cardDensity: 'denso' }) - merge with existing:");
const mergedConfig = setConfig({ cardDensity: "denso" });
console.log(JSON.stringify(mergedConfig, null, 2));

// 6. Try invalid value (should throw)
console.log("\n6. Trying invalid value - setConfig({ validityAlertDays: -5 }):");
try {
  setConfig({ validityAlertDays: -5 });
  console.log("ERROR: Should have thrown!");
} catch (error) {
  console.log("✓ Correctly threw error:", error.message);
}

// 7. Try invalid cardDensity
console.log("\n7. Trying invalid cardDensity - setConfig({ cardDensity: 'ultra' }):");
try {
  setConfig({ cardDensity: "ultra" });
  console.log("ERROR: Should have thrown!");
} catch (error) {
  console.log("✓ Correctly threw error:", error.message);
}

console.log("\n=== Demo Complete ===");
