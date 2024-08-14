'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
const Generator = require('./GeneratorBase');

class CommentBlockGenerator extends Generator {
    constructor(settings) { super({ ...settings, condition: '/*' }); }

    /** @type {KLF.GetTokenCallback} */
    getToken(ast, context) {
        const endOfComment = ast.remainder.indexOf('*/');
        const raw = ast.remainder.slice(0, endOfComment + 2);
        const token = ast.startToken({ type: TokenType.CommentBlock, raw });
        return { token };
    }
}

module.exports = CommentBlockGenerator;
