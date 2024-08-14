'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
const
    AstBuilder = require('./AstBuilder');

/**
 * Object that parses source code into a DOM
 * @type {KLF.IAstBuilder}
 */
class AstBuilderJS extends AstBuilder {
    /**
     * Construct a new AstTreeBuilder
     * @param {KLF.IAstBuilder<TokenType>} settings
     */
    constructor(settings) {
        super(settings);

        this.pushContext({ scope: false, thisClass: false, thisFunction: false, thisMember: false, variables: {} });
    }

    /**
     * Get a list of AST providers for the nextToken() call
     * @param {KLF.TokenType} expected Optional explicit list of tokens to expect
     * @returns {KLF.IAstGenerator[]}
     */
    preparePipeline(expected = []) {
        const pipeline = super.preparePipeline(expected),
            whitespaceProvider = this.getProviderById(TokenType.Whitespace);

        // Always allow for whitespace
        if (pipeline.findIndex(p => whitespaceProvider) === -1)
            pipeline.push(whitespaceProvider);

        return pipeline;
    }
}

module.exports = AstBuilderJS;