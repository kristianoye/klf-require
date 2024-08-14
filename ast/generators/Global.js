'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
const Generator = require('./GeneratorBase');

class GlobalGenerator extends Generator {
    constructor(settings) {
        super({ ...settings, weight: Number.MAX_SAFE_INTEGER });
    }

    /** @type {KLF.TestTokenCallback<KLF.IToken>} */
    test(ast, context) { return !context.scope; }

    /** @type {KLF.GetTokenCallback<KLF.IToken>} */
    getToken(ast) {
        const token = ast.startToken({ type: TokenType.Global, raw: '' });
        ast.pushContext({ scope: 'global' });
        ast.removeProvider(this); // There can be only one... global
        return { token, leaveOpen: true };
    }
}

module.exports = GlobalGenerator;
