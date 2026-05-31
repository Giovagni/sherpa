"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOKEN_WARN_THRESHOLD = void 0;
exports.estimateTokens = estimateTokens;
// ~4 chars per token is a reasonable estimate for code/markdown
const CHARS_PER_TOKEN = 4;
function estimateTokens(text) {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}
exports.TOKEN_WARN_THRESHOLD = 8000;
//# sourceMappingURL=tokens.js.map