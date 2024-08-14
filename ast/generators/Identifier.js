'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
const Generator = require('./GeneratorBase');

class IdentifierGenerator extends Generator {
    constructor({ settings }) {
        super({ ...settings, condition: /^(?<identifier>[\p{L}_$][\p{L}\p{N}_$]*)/u, weight: 300 });
    }

    /** @type {KLF.GetTokenCallback} */
    getToken(ast, context, matchData) {
        const { identifier: raw } = matchData;
        const keywordTest = raw.toLowerCase();
        const token = ast.startToken({ type: TokenType.Identifier, raw, name: raw });
        if (keywordTest in ReservedWord) {
            token.type = TokenType.ReservedWord;
        }
        return { token };
    }
}

module.exports = IdentifierGenerator;
