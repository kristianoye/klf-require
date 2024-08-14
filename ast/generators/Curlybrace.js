'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
const Generator = require('./GeneratorBase');

class CurlyBraceGenerator extends Generator {
    /** @param {KLF.IAstGenerator<KLF.IToken>} */
    constructor(settings) {
        super({ ...settings, condition: /^(?<raw>[\{\}])/, tokenType: TokenType.CurlyBrace });
    }
}

module.exports = CurlyBraceGenerator;
