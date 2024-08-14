'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
const GeneratorBase = require('./GeneratorBase');

class AssignmentGenerator extends GeneratorBase {
    /** @param {KLF.IAstGenerator<KLF.IToken>} */
    constructor(settings) {
        super({ ...settings, condition: /(?<operator>=|\+=|-=|\*=|\/=|%=|\*\*=|<<=|>>=|>>>=|&=|\^=|\|=|&&=|\|\|=|\?\?=)/ });
    }

    /** @type {KLF.GetTokenCallback} */
    getToken(ast, context, { operator }) {
        const token = ast.startToken({ type: TokenType.Assignment, raw: operator, operator });
        return token;
    }
}

module.exports = AssignmentGenerator;
