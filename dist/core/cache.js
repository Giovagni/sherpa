"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCache = loadCache;
exports.saveCache = saveCache;
exports.reconstructFromCache = reconstructFromCache;
exports.getCacheFile = getCacheFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CACHE_VERSION = 1;
function loadCache(cwd) {
    try {
        const raw = fs.readFileSync(getCacheFile(cwd), 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.version !== CACHE_VERSION)
            return emptyCache();
        return parsed;
    }
    catch {
        return emptyCache();
    }
}
function saveCache(cwd, cache) {
    const file = getCacheFile(cwd);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf8');
}
function reconstructFromCache(cache) {
    const exportsMap = [];
    const importsMap = [];
    const importedBy = new Map();
    const symbols = [];
    for (const [rel, fc] of Object.entries(cache.files)) {
        if (fc.exports.length > 0)
            exportsMap.push({ file: rel, names: fc.exports });
        if (fc.importsFrom.length > 0) {
            importsMap.push({ file: rel, importsFrom: fc.importsFrom });
            for (const dep of fc.importsFrom) {
                const list = importedBy.get(dep) ?? [];
                list.push(rel);
                importedBy.set(dep, list);
            }
        }
        symbols.push(...fc.symbols);
    }
    return {
        files: Object.keys(cache.files).length,
        exports: exportsMap,
        imports: importsMap,
        importedBy,
        symbols,
    };
}
function getCacheFile(cwd) {
    return path.join(cwd, '.claude', 'manifest.cache.json');
}
function emptyCache() {
    return { version: CACHE_VERSION, generatedAt: new Date().toISOString(), files: {} };
}
//# sourceMappingURL=cache.js.map