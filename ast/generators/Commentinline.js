'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
const Generator = require('./GeneratorBase');

class CommentInlineGenerator extends Generator {
    constructor(settings) { super({ ...settings, condition: '//' }); }

    /** @type {KLF.GetTokenCallback} */
    getToken(ast, context) {
        const raw = ast.readEOL();
        const token = ast.startToken({ type: TokenType.CommentInline, raw });
        return { token };
    }
}

module.exports = CommentInlineGenerator;
