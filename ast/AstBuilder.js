/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
'use strict';

const
    GeneratorBase = require('./generators/GeneratorBase'),
    events = require('events'),
    path = require('path'),
    fs = require('fs');

/**
 * @type {KLF.IAstBuilder<KLF.IToken>}
 */
class AstBuilder extends events.EventEmitter {
    /**
     * Construct a new AstTreeBuilder
     * @param {KLF.IAstBuilder<IToken>} settings
     */
    constructor(settings) {
        super();

        /**
         * A flat array of all tokens created, in the order they were created
         */
        this.allTokens = [];

        this.loader = settings.loader;
        this.manager = this.loader.manager;
        this.filename = settings.filename;
        this.remainder = this.source = settings.source;

        /** @type {KLF.ITokenizerContext[]} */
        this.contextStack = [];

        /** @type {KLF.ITokenizerContext} */
        this.context = false;

        /** @type {KLF.IToken[]} */
        this.openTokens = [];

        /**
         * The current file position
         * @type {KLF.SourcePosition}
         */
        this.position = { line: 0, char: 0, col: 0 };

        /**
         * The token provider collections
         */
        this.tokenProviders = { ...this.loader.tokenProviders };
        this.tokenProvidersById = { ...this.loader.tokenProvidersById };
        this.tokenProvidersSorted = [...this.loader.tokenProvidersSorted];
    }

    /** Clone the current position */
    clonePosition() {
        return { ...this.position }
    }

    /**
     * Returns the number of newlines in a string
     * @param {string} str The string to inspect
     * @param {number} col Current column number
     * @returns 
     */
    countLines(str, col = 0) {
        let lines = 0;
        for (let i = 0; i < str.length; i++) {
            if (str.charAt(i) === '\n') {
                col = 0;
                lines++;
            }
            else col++;
        }
        return { lines, col };
    }

    /**
     * Check the supplied string for whitespace
     * @param {string} str The string to check
     * @returns True if the string contains whitespace
     */
    containsWhitespace(str) {
        return str.search(/\s+/) > -1;
    }

    /** 
     * Assert that the next text in the stream matches our parameter 
     * @param {string} text The text to check against
     * @param {boolean} advancePosition If true, the current position will be updated
     * @returns {boolean | { token: KLF.IToken, nextToken: KLF.IToken[] }}
     */
    eatText(text, advancePosition = true) {
        if (typeof text === 'string' && text.length > 0) {
            const matchText = this.remainder.slice(0, text.length);
            if (matchText === text) {
                if (advancePosition) {
                    return this.nextToken();
                }
                return true;
            }
        }
        return false;
    }

    /** Advance the position to the next non-whitespace character */
    eatWhitespace() {
        const max = this.remainder.length
        if (this.position.char === max)
            return false;
        else if (!this.isWhitespace())
            return true;
        else {
            /** @type {KLF.IToken} */
            let c = 0;
            while (this.isWhitespace(c)) {
                if (++c === max)
                    break;
            }
            const result = this.startToken({ type: TokenType.Whitespace, raw: this.remainder.slice(0, c) });
            return this.endToken(result);
        }
    }

    /**
     * Finish/validate a token
     * @param {KLF.IToken} token The token to finish
     * @returns {KLF.IToken}
     */
    endToken(token, leaveOpen = false) {
        if (typeof token.raw !== 'string')
            throw new Error(`Cannot finish invalid token: ${JSON.stringify(token)} `);

        if (typeof token.end !== 'object') {
            this.updatePosition(token, leaveOpen === true);
        }

        return token;
    }

    /**
     * Get all known AST generators
     * @param {Partial<KLF.IModuleManager>} config The configuration being built
     * @returns {KLF.AstBuilderCollection}
     */
    static enumerateBuiltinTypes(config) {
        const files = fs.readdirSync(__dirname, { encoding: 'utf8' })
            .filter(f => {
                //  Do not load ourself!
                if (__filename.endsWith(f))
                    return false;
                return f.search(/AstGenerator[a-zA-Z]+\./i) > -1;
            })
            .map(f => path.join(__dirname, f));
        /** @type {KLF.ExtensionLoaderCollection} */

        config.ast = {
            baseBuilderType: AstBuilder,
            baseGeneratorType: GeneratorBase,
            builders: {},
            generators: {}
        };

        GeneratorBase.enumerateBuiltinTypes(config);

        for (const filename of files) {
            try {
                const builder = require(filename);
                const configData = typeof builder.getDefaultConfig === 'function' && builder.getDefaultConfig(config);

                if (builder.prototype instanceof this)
                    config.ast.builders[builder.name] = {
                        name: builder.name,
                        type: builder,
                        config: configData || {}
                    };
            }
            catch (er) {
                console.log(`Failed to load ${filename}: ${er}`);
            }
        }
    }

    /**
     * Are we at the end of file (EOF)?
     */
    isEOF() {
        return this.position.char === this.source.length;
    }

    /**
     * Get an AST provider using the TokenType ID
     * @param {KLF.TokenType} tokenType The type of token to fetch
     * @returns {KLF.IAstGenerator}
     */
    getProviderById(tokenType) {
        if (false === tokenType in this.tokenProvidersById)
            return false;
        return this.tokenProvidersById[tokenType];
    }

    /**
     * Get an AST provider using the human-friendly name
     * @param {string} name The type of token to fetch
     * @returns {KLF.IAstGenerator}
     */
    getProviderByName(name) {
        if (false === name in this.tokenProviders)
            return false;
        return this.tokenProviders[name];
    }

    /**
     * Retrieve the string representation of the provided token type ID
     * @param {KLF.TokenType} tokenType The token type to look up
     * @returns {string}
     */
    getProviderTokenName(tokenType) {
        if (false === tokenType in TokenType)
            return TokenType[TokenType.Unknown];
        else
            return TokenType[tokenType];
    }

    /**
     * Check to see if the current character was escaped
     * @returns Returns true if the previous character was an escape character
     */
    isEscaped() {
        if (this.position.char === 0)
            return false;
        else
            return this.remainder.charAt(this.position.char - 1) === '\\';
    }

    /** Is the current character whitespace? */
    isWhitespace(c) {
        const tester = /^[\s]+/;
        if (typeof c === 'string')
            return tester.test(c);
        else if (typeof c === 'number')
            return tester.test(this.remainder.charAt(c));
        else
            return tester.test(this.remainder);
    }

    /** 
     * Write a log message 
     * @param message The message to record
     * @param detailLevel The severity of the message
     * @param logData Additional logging information
     */
    log(message, detailLevel, logData = {}) {
        this.loader.log(message, detailLevel, logData);
        return this;
    }

    /**
     * Fetch the next token or return false if at the end of the document
     * @param {...KLF.TokenType[]} expect The token type we are expecting
     */
    nextToken(...expect) {
        /** @type {KLF.IAstGenerator[]} */
        const pipeline = this.preparePipeline(expect);

        if (pipeline.length === 0)
            throw new Error(`Loader ${this.loader.name} was asked to generate an AST token with an empty pipeline`);

        for (const generator of pipeline) {
            const testResult = generator.test(this, this.context);
            if (testResult) {
                const result = generator.getToken(this, this.context, testResult);

                if (typeof result === 'object') {
                    const token = result instanceof AstToken ? result : result.token;
                    const nextToken = Array.isArray(result.nextToken) ? result.nextToken : [];
                    const leaveOpen = result.leaveOpen === true;

                    //  Leave open if token is expecting children
                    this.endToken(token, leaveOpen === true);

                    //  Ignore whitespace
                    if (token.type === TokenType.Whitespace)
                        return this.nextToken(...expect);
                    else if (token)
                        return { token, nextToken };
                }
                else {
                }
            }
        }
        if (this.isEOF()) {
            this.log(`Loader ${loader.name} successfully created AST for module ${this.filename}`, LogDetailLevel.Verbose);
            return undefined;
        }
        else {
            const lastToken = this.allTokens[this.allTokens.length - 1];
            const pos = lastToken.end || lastToken.start;
            const snippet = `... "${this.source.slice(pos.char, pos.char + 5)}"`;
            const posText = lastToken.end
                ? `ending at ${JSON.stringify(lastToken.end)}`
                : `starting at ${JSON.stringify(lastToken.start)}`;
            this.log(`Loader ${loader.name} failed to create AST for module ${this.filename}; Last token read was ${lastToken.tokenName} ${posText}: ${snippet}`, LogDetailLevel.Debug);
            return false;
        }
    }

    /**
     * Pop the current context off the stack
     * @returns {KLF.ITokenizerContext} The old context
     */
    popContext() {
        const context = this.contextStack.shift();
        if (!context) {
            this.log(`Encountered error while parsing ${filename}`, LogDetailLevel.Error);
            throw new Error(`Parsing error in ${filename}`);
        }
        this.context = this.contextStack[0];
        return context;
    }

    /** 
     * Get a pipeline of token providers for the next token read 
     * @param {KLF.IAstGenerator[]?} expected Optional list of providers to limit size of pipeline
     */
    preparePipeline(expected = []) {
        const pipeline = expected.length && expected.map(id => this.tokenProvidersById[id]) || this.tokenProvidersSorted;
        return pipeline;
    }

    /**
     * Push new context data onto the stack
     * @param {Partial<KLF.ITokenizerContext} newContext Details about the new context
     * @returns {KLF.ITokenizerContext}
     */
    pushContext(newContext) {
        this.contextStack.unshift({ ...this.contextStack[0], ...newContext });
        return (this.context = this.contextStack[0]);
    }

    /** Read n number of characters */
    readText(n = 1) {
        return n === 1
            ? this.source.charAt(this.position.char)
            : this.source.slice(this.position.char, this.position.char + n);
    }

    /** 
     * Read all of the text until the end of line */
    readEOL() {
        const n = this.remainder.indexOf('\n');
        return this.remainder.slice(0, n);
    }

    /**
     * Remove a provider from the current AST-building process
     * @param {KLF.IAstGenerator} provider The provider to remove
     * @returns Returns true if the provider was found and removed
     */
    removeProvider(provider) {
        const { name, id } = provider;
        if (id in this.tokenProvidersById) {
            const index = this.tokenProvidersSorted.findIndex(p => p === provider);

            delete this.tokenProviders[name];
            delete this.tokenProvidersById[id];
            if (index > -1) this.tokenProvidersSorted.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Create a new token
     * @param {Partial<KLF.IToken>} partialToken Initial state of newly created token
     */
    startToken(partialToken = {}) {
        /** @type {KLF.SourcePosition} */
        const start = { ...this.position };
        /** @type {KLF.IToken} */
        const token = {
            type: TokenType.Unknown,
            start,
            ...partialToken
        };

        const result = new AstToken(token, this);
        token.index = this.allTokens.push(result) - 1;
        return result;
    }

    /**
     * Tokenize the source and return an AST
     * @returns {KLF.IToken}
     */
    tokenize() {
        /**
         * The root token
         * @type {KLF.IToken}
         */
        const { token } = this.nextToken();
        /** @type {{ token: KLF.IToken, nextToken: KLF.IToken[] }} */
        let result = { nextToken: [] };
        while (result = this.nextToken(...result.nextToken)) {
            token.children.push(result.token);
        };
        return token;
    }

    /** 
     * Update the position based on the state of the token
     * @param {KLF.IToken} token
     * @param {boolean} leaveOpen If left open, the element will be set up to receive children
     */
    updatePosition(token, leaveOpen = false) {
        if (typeof token.end !== 'object') {
            const len = token.raw.length;
            const current = { ...this.position };
            const { lines, col } = this.countLines(token.raw, current.col);
            const end = this.position = { char: current.char + len, col, line: current.line + lines };

            if (leaveOpen) {
                if (!Array.isArray(token.children))
                    token.children = [];
                this.openTokens.unshift(token);
            }
            else if (this.openTokens.length > 0)
                this.openTokens[0].children.push(token);

            if (!leaveOpen) token.end = end;
            this.remainder = this.remainder.slice(len);
        }
        else
            this.log(`${this.loader.name}: ${this.filename}: updatePosition() did not update position for token ${token.tokenName}; Token end already set`, LogDetailLevel.Verbose);
        return token;
    }
}

module.exports = AstBuilder;
