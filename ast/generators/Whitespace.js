'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
const Generator = require('./GeneratorBase');

class WhitespaceGenerator extends Generator {
    /** @param {KLF.IAstGenerator} */
    constructor(settings) { super({ ...settings, condition: /^(?<whitespace>[\s]+)/, weight: 1_000_000 }); }

    /** @type {KLF.GetTokenCallback} */
    getToken(ast, context, { whitespace }) {
        const token = ast.startToken({ type: TokenType.Whitespace, raw: whitespace })
        return { token };
    }
}

module.exports = WhitespaceGenerator;
