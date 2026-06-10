import { describe, it, expect, beforeEach, vi } from "vitest";
import { DEFAULT_CONFIG, getConfig, setConfig } from "./config";

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

// Replace global localStorage
global.localStorage = localStorageMock;

describe("config utility", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("DEFAULT_CONFIG", () => {
    it("deve ter valores padrão corretos", () => {
      expect(DEFAULT_CONFIG).toEqual({
        useMock: false,
        validityAlertDays: 30,
        cardDensity: "confortavel"
      });
    });
  });

  describe("getConfig", () => {
    it("deve retornar DEFAULT_CONFIG quando chave não existe", () => {
      const config = getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("deve retornar DEFAULT_CONFIG quando JSON é inválido", () => {
      localStorage.setItem("edustock:config", "invalid json{");
      const config = getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("deve fazer merge com defaults quando config armazenado é parcial", () => {
      localStorage.setItem("edustock:config", JSON.stringify({ useMock: true }));
      const config = getConfig();
      expect(config).toEqual({
        useMock: true,
        validityAlertDays: 30,
        cardDensity: "confortavel"
      });
    });

    it("deve retornar config válido completo", () => {
      const validConfig = {
        useMock: true,
        validityAlertDays: 45,
        cardDensity: "compacto"
      };
      localStorage.setItem("edustock:config", JSON.stringify(validConfig));
      const config = getConfig();
      expect(config).toEqual(validConfig);
    });

    it("deve retornar defaults quando useMock não é boolean", () => {
      localStorage.setItem("edustock:config", JSON.stringify({
        useMock: "true",
        validityAlertDays: 30,
        cardDensity: "confortavel"
      }));
      const config = getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("deve retornar defaults quando validityAlertDays não é positivo", () => {
      localStorage.setItem("edustock:config", JSON.stringify({
        useMock: false,
        validityAlertDays: -5,
        cardDensity: "confortavel"
      }));
      const config = getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("deve retornar defaults quando validityAlertDays não é inteiro", () => {
      localStorage.setItem("edustock:config", JSON.stringify({
        useMock: false,
        validityAlertDays: 30.5,
        cardDensity: "confortavel"
      }));
      const config = getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("deve retornar defaults quando cardDensity é inválido", () => {
      localStorage.setItem("edustock:config", JSON.stringify({
        useMock: false,
        validityAlertDays: 30,
        cardDensity: "invalido"
      }));
      const config = getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe("setConfig", () => {
    it("deve persistir config no localStorage", () => {
      const updates = { useMock: true };
      setConfig(updates);
      const stored = JSON.parse(localStorage.getItem("edustock:config"));
      expect(stored.useMock).toBe(true);
    });

    it("deve fazer merge com config existente", () => {
      localStorage.setItem("edustock:config", JSON.stringify({
        useMock: true,
        validityAlertDays: 60,
        cardDensity: "denso"
      }));
      
      const result = setConfig({ validityAlertDays: 45 });
      
      expect(result).toEqual({
        useMock: true,
        validityAlertDays: 45,
        cardDensity: "denso"
      });
    });

    it("deve retornar novo config após merge", () => {
      const result = setConfig({ 
        useMock: true, 
        cardDensity: "compacto" 
      });
      
      expect(result).toEqual({
        useMock: true,
        validityAlertDays: 30,
        cardDensity: "compacto"
      });
    });

    it("deve lançar erro quando updates contém valores inválidos", () => {
      expect(() => {
        setConfig({ useMock: "not a boolean" });
      }).toThrow("Invalid configuration values");
    });

    it("deve lançar erro quando validityAlertDays é negativo", () => {
      expect(() => {
        setConfig({ validityAlertDays: -1 });
      }).toThrow("Invalid configuration values");
    });

    it("deve lançar erro quando validityAlertDays não é inteiro", () => {
      expect(() => {
        setConfig({ validityAlertDays: 30.7 });
      }).toThrow("Invalid configuration values");
    });

    it("deve lançar erro quando cardDensity é inválido", () => {
      expect(() => {
        setConfig({ cardDensity: "super-denso" });
      }).toThrow("Invalid configuration values");
    });

    it("deve aceitar todas as densidades válidas", () => {
      expect(() => setConfig({ cardDensity: "confortavel" })).not.toThrow();
      expect(() => setConfig({ cardDensity: "compacto" })).not.toThrow();
      expect(() => setConfig({ cardDensity: "denso" })).not.toThrow();
    });
  });
});
