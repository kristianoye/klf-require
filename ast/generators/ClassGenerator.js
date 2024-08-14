'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
const GeneratorBase = require('./GeneratorBase');

/**@type {KLF.ITokenProvider<KLF.IToken} */
class ClassGenerator extends GeneratorBase {
    constructor(settings) {
        super({ settings, condition: /^(?<raw>class)/, weight: 200 });
    }

    /** @type {KLF.GetTokenCallback} */
    getToken(ast, context, { raw }) {
        const token = ast.startToken({ type: TokenType.Class, raw });
        ast.pushContext({ scope: 'class', thisClass: token });
        ast.updatePosition(token);

        this.tryClassName(ast, token);
        this.trySuperClass(ast, token);

        return { token, leaveOpen: true };
    }

    /** 
     * @param {KLF.IAstGenerator<KLF.IToken>} ast The parser
     * @param {KLF.IToken} parent The class token
    */
    tryClassName(ast, parent) {
        ast.eatWhitespace();
        const { token } = ast.nextToken(TokenType.Identifier);
        if (token) {
            parent.className = token.name;
            return token;
        }
    }

    /** 
     * @param {KLF.IAstGenerator<KLF.IToken>} ast The parser
     * @param {KLF.IToken} parent The class token
    */
    trySuperClass(ast, parent) {
        ast.eatWhitespace();
        if (ast.tryRead(ReservedWord.Extends)) {
            ast.eatWhitespace();
            const { token } = ast.nextToken(TokenType.Identifier);
            parent.superClass = token;
            parent.superClassName = token.name;
            return token;
        }
    }
}

module.exports = ClassGenerator;