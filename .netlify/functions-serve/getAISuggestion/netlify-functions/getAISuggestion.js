var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify-functions/getAISuggestion.js
var getAISuggestion_exports = {};
__export(getAISuggestion_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(getAISuggestion_exports);

// netlify-functions/services/monitoringService.ts
var Logger = {
  info: (message, data) => console.log(`[INFO] ${(/* @__PURE__ */ new Date()).toISOString()} | ${message}`, data || ""),
  warn: (message, data) => console.warn(`[WARN] ${(/* @__PURE__ */ new Date()).toISOString()} | ${message}`, data || ""),
  error: (message, error, data) => {
    const errorData = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { error };
    console.error(`[ERROR] ${(/* @__PURE__ */ new Date()).toISOString()} | ${message}`, { ...errorData, ...data });
  }
};
var metrics = {
  totalTransactions: 0,
  processingTimeMs: 0,
  filesParsed: 0,
  parsingErrors: 0,
  matches: 0,
  divergences: 0,
  apiErrors: 0
};
var Metrics = {
  increment: (key, value = 1) => {
    if (metrics[key] !== void 0) metrics[key] += value;
  },
  set: (key, value) => {
    if (metrics[key] !== void 0) metrics[key] = value;
  },
  reset: () => {
    Object.keys(metrics).forEach((k) => metrics[k] = 0);
  },
  get: () => ({ ...metrics })
};

// netlify-functions/getAISuggestion.js
var handler = async (event) => {
  try {
    Logger.info("Fun\xE7\xE3o getAISuggestion chamada", { event });
    Metrics.increment("totalTransactions");
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Fun\xE7\xE3o executada com sucesso",
        metrics: Metrics.get()
      })
    };
  } catch (error) {
    Logger.error("Erro na fun\xE7\xE3o getAISuggestion", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Erro interno",
        error: error.message
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=getAISuggestion.js.map
