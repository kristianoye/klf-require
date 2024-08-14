/// <reference path="index.d.ts" />
try {
    /*
     * Written by Kris Oye <kristianoye@gmail.com>
     * Date: August 10, 2024
     *
     * Default functionality provides additional macros for use in your code:
     *
     * __callString Shortcut for either:
     *          __member + '.' + __method + '()'
     *      or
     *          __function + '()'
     * __class The name of the encapsulating class
     * __date Current date [MAGIC]
     * __ext Filename extension of current module
     * __file Filename without directory
     * __fileBase Filename without directory or extension
     * __function The name of the encapsulating function
     * __time Current timestamp [MAGIC]
     * __member The name of the encapsulating member function
     * __method (synonym for __member)
     *
     * TODO:
     * Add hot loading feature with __getState / __setState handlers
     */
    const fs = require('fs'),
        path = require('path'),
        Module = require('module'),
        events = require('events');

    var
        /** @type {KLF.IModuleManager} */
        config = {};

    //#region Helper Methods

    /**
     * Assign numeric values to each key in a dictionary;
     * Allow for lookup by name or index
     * @template T
     * @param {string} typeName The name of the enum type
     * @param {T} o The object to enumerate
     * @param {KLF.EnumType} enumType The type of enum
     * @returns {T & { parse: function(string | number): T, toString: function(string | number): string, tryParse: function(string | number, defaultValue: T, getNVP: false ): T }}
     */
    function createEnum(typeName, o, enumType = 'number') {
        /** @type {KLF.EnumType[]} */
        const validTypes = ['bitflag', 'number', 'string'];
        if (validTypes.indexOf(enumType) === -1)
            throw new Error(`${__filename}: '${enumType}' is not a valid enum type for ${typeName}`);
        var result = {
            ...o,
            enumType,
            keyNames: Object.keys(o),
            typeName,
            typeNamePrefix: typeName.toLowerCase() + '.',
            /**
             * Attempt to convert a number or string into one of our specified values
             * @param {string | number} spec The supplied value
             * @param {T?} defaultValue default value
             * @returns {KLF.ScriptENUM}
             */
            tryParse: function (spec, defaultValue = undefined, getNVP = false, withTypeName = true) {
                if (getNVP) {
                    const name = this.tryParse(spec, defaultValue, false, withTypeName),
                        value = typeof name == 'string' && this[name] || undefined;
                    if (typeof name !== 'undefined')
                        return { name, value };
                    else
                        return undefined;
                }
                else if (typeof spec === 'string') {
                    /** @type {(string | number)[]} */
                    const parts = spec.split('|')
                        .map(s => {
                            s = s.trim().toLowerCase();
                            if (s.startsWith(this.typeNamePrefix))
                                s = s.slice(this.typeNamePrefix.length);
                            return this[s];
                        });

                    if (parts.length === 0)
                        return defaultValue;
                    else if (this.enumType === 'bitflag') {
                        if (this.enumType === 'bitflag') {
                            let result = 0;
                            for (const val of parts) {
                                if (typeof val === 'number') {
                                    result |= val;
                                }
                            }
                            return result;
                        }
                    }
                    else if (this.enumType === 'number') {
                        if (parts.length === 1)
                            return parts[0];
                        else
                            return parts;
                    }
                    else if (this.enumType === 'string') {
                        if (parts.length === 1)
                            return parts[0];
                        else
                            return parts;
                    }
                }
                else if (typeof spec === 'number') {
                    if (this.enumType === 'bitflag') {
                        const result = [], values = {};
                        for (const [key, val] of Object.entries(this)) {
                            const numericKey = parseInt(val);
                            if (!isNaN(numericKey)) {
                                //  Do not display every possible name mapped
                                if (numericKey in values) continue;
                                if ((numericKey & spec) > 0) {
                                    result.push(`${typeName}.${key}`);
                                    values[numericKey] = val;
                                }
                            }
                        }
                        if (result.length === 0)
                            return defaultValue;
                        return result.join(' | ');
                    }
                    else if (this.enumType === 'number') {
                        const result = this[spec];
                        if (typeof result === 'undefined')
                            return defaultValue;
                        return withTypeName ? `${typeName}.${result} ` : result;
                    }
                    else if (this.enumType === 'string') {
                        const result = this[spec];
                        if (typeof result === 'undefined')
                            return defaultValue;
                        return result;
                    }
                }
                return undefined;
            },
            /**
             * Attempt to convert a number or string into one of our specified values
             * Throws an exception if the type does not contain a matching key
             * @param {string | number} spec The supplied value
             * @returns {{KLF.ScriptENUM}
             */
            parse: function (spec, getNVP = false) {
                const result = this.tryParse(spec, undefined, getNVP);
                if (typeof result !== 'undefined')
                    return result;
                throw new Error(`parse() failed to determine value for ${spec}`);
            },
            toString: function (spec) {
                const { name } = this.parse(spec, true);
                return `${this.typeName}.${name}`;
            }
        };
        let c = enumType === 'bitflag' ? 1 : 0;
        for (const [key, val] of Object.entries(o)) {
            //  Did the type define specific, numeric values?
            if (enumType === 'number') {
                let actualVal = typeof val === 'number' ? val : c++;

                // Reverse lookup
                result[actualVal] = key;

                // Forward lookups
                result[key] = actualVal;
                result[key.toLowerCase()] = actualVal;
            }
            else if (enumType === 'bitflag') {
                if (typeof val !== 'number') {
                    if (c < 0) {
                        throw new Error(`Too many flags defined in type ${typeName} `);
                    }
                    result[c] = key;
                    // Forward lookups
                    result[key] = c;
                    result[key.toLowerCase()] = c;
                    c <<= 1;
                }
                else {
                    // Reverse lookup
                    result[flagValue] = key;
                    // Forward lookups
                    result[key] = c;
                    result[key.toLowerCase()] = c;
                }
            }
            else if (enumType === 'string') {
                // Reverse lookup
                result[val] = key;
                // Forward lookups
                result[key] = val;
                result[key.toLowerCase()] = val;
            }
        }
        return Object.freeze(result), Object.seal(result);
    }

    /**
     * Attempt to find node_modules in our path structure
     * @returns {string[]}
     */
    function locateNodeModulesDirectory() {
        const pathParts = __dirname.split(path.sep).filter(s => s.length > 0),
            result = [];
        while (pathParts.length > 0) {
            const thisPath = pathParts.join(path.sep),
                nodeInPath = path.join(thisPath, 'node_modules');

            if (thisPath.endsWith('node_modules'))
                result.push(thisPath);
            else {
                try {
                    fs.statfsSync(nodeInPath);
                    result.push(nodeInPath);
                }
                catch { }
            }
            pathParts.pop();
        }
        return result;
    }

    /**
     *
     * @param {Object.<string,any>} source The starting point
     * @param {...Object.<string,any>} updates Object(s) to merge into the original source
     */
    function mergeConfigs(source, ...updates) {
        const isClass = (v) => { return typeof v === 'function' && v.toString().startsWith('class') };

        if (typeof source !== 'object')
            throw new Error(`Bad argument 1 to mergeObjects(); Expected object but got ${typeof source} `);
        var result = { ...source };
        for (const update of updates) {
            for (const [key, val] of Object.entries(update)) {
                if (Array.isArray(val)) {
                    result[key] = val.slice(0);
                }
                else if (typeof val === 'object') {
                    if (false === key in result)
                        result[key] = {};
                    else if (isClass(result[key])) {
                        if (typeof result[key].defaultConfig === 'object')
                            result[key].defaultConfig = mergeConfigs(result[key].defaultConfig, val);
                        continue;
                    }
                    result[key] = mergeConfigs(result[key] || {}, val);
                }
                else {
                    result[key] = val;
                }
            }
        }
        return result;
    }

    function parseRegex(regex) {
        const groupPattern = /(?<reclass>\[.*?\])|(?<capture>\(.*?\))/g;
        const matches = [];
        let match;

        while ((match = groupPattern.exec(regex)) !== null) {
            const { reclass, capture } = match.groups,
                result = {
                    group: reclass || capture,
                    reclass,
                    capture,
                    length: ((reclass || '') + (capture + '')).length
                };

            if (capture) {
                result.captureDef = parseRegex(capture.slice(1, capture.length - 1)) || capture;
            }
            matches.push(result);
        }

        return matches;
    }

    //#endregion

    //#region Enums

    const
        DetailLevelString = ['', '   NONE', '  ERROR', 'WARNING', '  DEBUG', 'VERBOSE'],
        LogDetailLevel = createEnum('LogDetailLevel', {
            /** Inane detail */
            Verbose: 5,
            /** Information helpful to configuring the importer */
            Debug: 4,
            /** Some expected behavior did not execute as expected */
            Warning: 3,
            /** An error occurred and the current module could not be handled */
            Error: 2,
            /** No Detail provided */
            None: 1
        }),
        ReservedWord = createEnum('ReservedWord', {
            Await: 'await',
            Break: 'break',
            Case: 'case',
            Catch: 'catch',
            Class: 'class',
            Const: 'const',
            Continue: 'continue',
            Debugger: 'debugger',
            Default: 'default',
            Delete: 'delete',
            Do: 'do',
            Else: 'else',
            Export: 'export',
            Extends: 'extends',
            Finally: 'finally',
            For: 'for',
            Function: 'function',
            If: 'if',
            Implements: 'implements',
            In: 'in',
            Interface: 'interface',
            InstanceOf: 'instanceof',
            Let: 'let',
            New: 'new',
            Package: 'package',
            Private: 'private',
            Protected: 'protected',
            Public: 'public',
            Return: 'return',
            Static: 'static',
            Super: 'super',
            Switch: 'switch',
            This: 'this',
            Throw: 'throw',
            Try: 'try',
            TypeOf: 'typeof',
            Var: 'var',
            Void: 'void',
            While: 'while',
            With: 'with',
            Yield: 'yield'
        }, 'string'),
        TokenizerScope = createEnum('TokenizerScope', {
            ArrowFunction: 'ArrowFunction',
            Class: 'Class',
            Function: 'Function',
            Global: 'Global',
            Member: 'Member'
        }),
        TokenType = createEnum('TokenType', {
            Unknown: 'Unknown',
            ArrowFunction: 'ArrowFunction',
            Assignment: 'Assignment',
            BlockStatement: 'BlockStatement',
            BlockStatementEnd: 'BlockStatementEnd',
            BlockStatementStart: 'BlockStatementStart',
            CurlyBrace: 'CurlyBrace',
            Class: 'Class',
            ClassBody: 'ClassBody',
            CommentBlock: 'CommentBlock',
            CommentInline: 'CommentInline',
            Equality: 'Equality',
            Function: 'Function',
            /** The global namespace */
            Global: 'Global',
            Identifier: 'Identifier',
            Member: 'Member',
            /** A numeric literal */
            Number: 'Number',
            Parameter: 'Parameter',
            ParameterList: 'ParameterList',
            ParameterListEnd: 'ParameterListEnd',
            Paranthesis: 'Paranthesis',
            RawText: 'RawText',
            ReservedWord: 'ReservedWord',
            Semicolon: 'Semicolon',
            Whitespace: 'Whitespace'
        });

    //#endregion

    class AstTokenProvider {
        /**
         * Construct the provider
         * @param {Partial<KLF.ITokenProvider>} settings
         */
        constructor(settings) {
            if (typeof settings.condition === 'undefined')
                settings.condition = () => true;
            AstTokenProvider.fill(this, {
                weight: AstTokenProvider.calculateWeight(settings),
                ...settings,
            });
            this.tokenType = typeof settings.tokenType === 'number' && settings.tokenType in TokenType && settings.tokenType;
        }

        /** 
         * @param {AstTokenProvider} instance The instance to fill
         * @param {Partial<KLF.ITokenProvider>} settings The settings to put into instance
         */
        static fill(instance, settings) {
            for (const [key, val] of Object.entries(settings)) {
                instance[key] = val;
            }
        }

        /**
         * Create a sorting weight based on the condition
         * @param {KLF.ITokenProvider} instance 
         * @returns 
         */
        static calculateWeight(instance) {
            const condition = instance.condition;
            if (typeof condition === 'string')
                return 100 + condition.length;
            else if (typeof condition === 'object' && condition instanceof RegExp) {
                const matches = parseRegex(condition.toString());
                let weight = -1;
                for (const data of matches) {
                    const { reclass, capture } = data;
                    if (reclass) {
                        // match zero or more
                        if (reclass.endsWith('*'))
                            weight -= 100;
                        // match one or more
                        else if (reclass.endsWith('+'))
                            weight -= 50;
                        // match single character
                        else if (reclass.endsWith(']'))
                            weight += 50;
                        else if (reclass.endsWith('}')) {
                            const s = reclass.lastIndexOf('{'),
                                e = reclass.lastIndexOf('}'),
                                r = reclass.slice(s + 1, e),
                                rp = r.split(',').map(s => s.trim()).filter(s => s.length > 0).unshift();
                            weight -= (rp ** rp);
                        }
                    }
                    else if (capture) {
                        instance.hasCapture = true;
                    }
                }
                return weight;
            }
            else if (typeof condition === 'function') {
                return 1;
            }
            else
                throw new Error(`AstTokenProvider '${instance.name}' does not have a valid test condition`);
        }

        /**
         * Attempt to create a token given the information we have
         * @param {KLF.IAstGenerator} ast The AST builder
         * @param {KLF.ITokenizerContext} context The current context
         * @param {string} raw The raw text read from source
         */
        getToken(ast, context, raw) {
            if (this.tokenType) {
                const { condition } = this;
                if (typeof condition === 'string') {
                    return ast.startToken({
                        type: this.tokenType,
                        raw
                    })
                }
                else if (typeof condition === 'object' && condition instanceof RegExp) {
                    return ast.startToken({
                        type: this.tokenType,
                        ...raw
                    });
                }
            }
            throw new Error('not implemented');
        }

        /**
         * Test to see if this provider can construct a token
         * @param {KLF.AstGenerator<any>} parent The generator creating AST
         * @param {KLF.ITokenizerContext} context The current context
         * @returns {boolean}
         */
        test(parent, context) {
            if (typeof this.condition === 'string' && this.condition.length > 0) {
                const slice = parent.remainder.slice(0, this.condition.length);
                return slice === this.condition && slice;
            }
            else if (typeof this.condition === 'object' && this.condition instanceof RegExp) {
                if (this.hasCapture === true) {
                    const match = this.condition.exec(parent.remainder);
                    return match !== null && (match.groups || true);
                }
                else
                    return this.condition.test(parent.remainder);
            }
            else if (typeof this.condition === 'function') {
                return this.condition.call(this, this, this.context);
            }
        }
    }

    class AstAssignment extends AstTokenProvider {
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

    class AstCurlyBrace extends AstTokenProvider {
        /** @param {KLF.IAstGenerator<KLF.IToken>} */
        constructor(settings) {
            super({ ...settings, condition: /^(?<raw>[\{\}])/, tokenType: TokenType.CurlyBrace });
        }
    }

    /**
     * @type {KLF.ITokenProvider<KLF.IToken}
     */
    class AstClass extends AstTokenProvider {
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

    class AstCommentBlock extends AstTokenProvider {
        constructor(settings) { super({ ...settings, condition: '/*' }); }

        /** @type {KLF.GetTokenCallback} */
        getToken(ast, context) {
            const endOfComment = ast.remainder.indexOf('*/');
            const raw = ast.remainder.slice(0, endOfComment + 2);
            const token = ast.startToken({ type: TokenType.CommentBlock, raw });
            return { token };
        }
    }

    class AstCommentInline extends AstTokenProvider {
        constructor(settings) { super({ ...settings, condition: '//' }); }

        /** @type {KLF.GetTokenCallback} */
        getToken(ast, context) {
            const raw = ast.readEOL();
            const token = ast.startToken({ type: TokenType.CommentInline, raw });
            return { token };
        }
    }

    class AstEquality extends AstTokenProvider {
        /** @param {KLF.IAstGenerator<KLF.IToken>} */
        constructor(settings) {
            super({ ...settings, condition: /^(?<operator>(?:===|==|\!==|\!=))/ });
        }

        /** @type {KLF.GetTokenCallback} */
        getToken(ast, context, { operator }) {
            const token = ast.startToken({ type: TokenType.Equality, raw: operator, operator });
            return token;
        }
    }

    class AstGlobal extends AstTokenProvider {
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

    class AstIdentifier extends AstTokenProvider {
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

    class AstFunction extends AstTokenProvider {
        /** @param {KLF.IAstGenerator} */
        constructor(settings) { super({ ...settings, condition: 'function' }); }

        /** @type {KLF.GetTokenCallback} */
        getToken(ast, context) {
            return {};
        }
    }

    class AstNumber extends AstTokenProvider {
        /** @param {KLF.IAstGenerator} */
        constructor(settings) {
            super(settings);
            //  Could I combine them into one, big, gross regex... sure?
            this.testers = [
                /^(?<decimal>[1-9](?:_?[0-9]+\.?)+(?:_?[0-9]+\.?)*n?)/,
                /^(?<hex>0[xX][a-fA-F0-9](?:_?[a-fA-F0-9]+)+n?)/,
                /^(?<exp>[0-9]+[eE]-[0-9+]n?)/,
                /^(?<binary>0[bB][01]?(_?[01]+)*n?)/, // BUG: Allows multiple underscores
                /^(?<octal>0[oO][0-7]+n*)/
            ]
        }

        /** @type {KLF.TestTokenCallback} */
        test(ast, context) {
            for (const test of this.testers) {
                const match = test.exec(ast.remainder);
                if (match === null) return false;
                const { decimal, hex, exp, binary, octal } = match.groups;
                if (decimal)
                    return { raw: decimal, format: 'decimal' };
                else if (hex) {
                    return { raw: hex, format: 'hexidecimal' };
                }
                else if (exp) {
                    if (binary.indexOf('__') > -1)
                        return false;
                    return { raw: binary, format: 'exponential' };
                }
                else if (octal) {
                    return { raw: octal, format: 'octal' };
                }
            }
        }

        /** @type {KLF.GetTokenCallback} */
        getToken(ast, context, { raw, format }) {
            const token = ast.startToken({ type: TokenType.Number, raw, format, isBigInt: raw.endsWith('n') });
            return { token };
        }
    }

    class AstParanthesis extends AstTokenProvider {
        /** @param {KLF.IAstGenerator<KLF.IToken>} */
        constructor(settings) {
            super({ ...settings, condition: /^(?<raw>[\(\)])/, tokenType: TokenType.Paranthesis });
        }
    }

    class AstSemicolon extends AstTokenProvider {
        /** @param {KLF.IAstGenerator} */
        constructor(settings) {
            super({ ...settings, condition: ';', tokenType: TokenType.Semicolon });
        }
    }

    /** 
     * @type {KLF.IToken} 
     * @class
     */
    class AstToken {
        /**
         * Create a new token
         * @param {KLF.IToken} config The initial properties
         * @param {KLF.IAstGenerator<KLF.IToken>} creator The AST generator that created this
         */
        constructor(config, creator) {
            this.body = config.body;
            this.children = config.children;
            this.end = config.end;
            this.name = config.name;
            this.ordinal = config.ordinal;
            this.raw = config.raw;
            this.start = config.start;
            this.superClass = config.superClass;
            this.superClassName = config.superClassName;
            this.type = typeof config.type === 'number' && config.type in TokenType && config.type || TokenType.Unknown;
            this.value = config.value;

            Object.defineProperties(this, {
                creator: {
                    get: () => creator,
                    configurable: false,
                    enumerable: false
                },
                tokenName: {
                    get: () => {
                        if (this.type in TokenType)
                            return TokenType[this.type];
                        else
                            return TokenType[TokenType.Unknown];
                    },
                    configurable: false,
                    enumerable: true
                }
            });
        }
    }

    class AstWhitespace extends AstTokenProvider {
        /** @param {KLF.IAstGenerator} */
        constructor(settings) { super({ ...settings, condition: /^(?<whitespace>[\s]+)/, weight: 1_000_000 }); }

        /** @type {KLF.GetTokenCallback} */
        getToken(ast, context, { whitespace }) {
            const token = ast.startToken({ type: TokenType.Whitespace, raw: whitespace })
            return { token };
        }
    }

    /**
     * @typedef {events.EventEmitter & KLF.IAstGenerator<any>} AstGenerator
     */
    /**
     * @type {KLF.IAstGenerator<KLF.IToken>}
     */
    class AstGenerator extends events.EventEmitter {
        /**
         * Construct a new AstTreeBuilder
         * @param {KLF.IAstGenerator<IToken>} settings
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
         * Are we at the end of file (EOF)?
         */
        isEOF() {
            return this.position.char === this.source.length;
        }

        /**
         * Get an AST provider using the TokenType ID
         * @param {KLF.TokenType} tokenType The type of token to fetch
         * @returns {KLF.ITokenProvider}
         */
        getProviderById(tokenType) {
            if (false === tokenType in this.tokenProvidersById)
                return false;
            return this.tokenProvidersById[tokenType];
        }

        /**
         * Get an AST provider using the human-friendly name
         * @param {string} name The type of token to fetch
         * @returns {KLF.ITokenProvider}
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
            /** @type {KLF.ITokenProvider[]} */
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
         * @param {KLF.ITokenProvider[]?} expected Optional list of providers to limit size of pipeline
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
         * @param {KLF.ITokenProvider} provider The provider to remove
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

    /**
     * Object that parses source code into a DOM
     * @type {KLF.IAstGenerator}
     */
    class AstGeneratorJS extends AstGenerator {
        /**
         * Construct a new AstTreeBuilder
         * @param {KLF.IAstGenerator<TokenType>} settings
         */
        constructor(settings) {
            super(settings);

            this.pushContext({ scope: false, thisClass: false, thisFunction: false, thisMember: false, variables: {} });
        }

        /**
         * Get a list of AST providers for the nextToken() call
         * @param {KLF.TokenType} expected Optional explicit list of tokens to expect
         * @returns {KLF.ITokenProvider[]}
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

    class ExtensionLoader extends events.EventEmitter {
        /**
         * Do base class type stuff
         * @param {ModuleManager} manager The ModuleManager singleton
         * @param {KLF.IExtensionLoader} settings The settings used to configure this loader
         */
        constructor(manager, settings) {
            super();

            /** @type {typeof AstGenerator} */
            this.astGenerator = settings.astGenerator;

            /** @type {boolean} */
            this.enabled = settings.enabled === true;

            /** @type {KLF.LoaderFilter[]} */
            this.exclude = Array.isArray(settings.exclude) ? settings.exclude : [];

            /** @type {string} */
            this.extensions = Array.isArray(settings.extensions) ? settings.extensions : [];

            /** @type {KLF.LoaderFilter[]} */
            this.include = Array.isArray(settings.include) ? settings.include : [];

            /** @type {KLF.LoaderFilterCallback} */
            this.onExclude = settings.onExclude || false;

            /** @type {KLF.LoaderFilterCallback} */
            this.onInclude = settings.onInclude || false;

            /** @type {ModuleManager} */
            this.manager = manager;

            /** @type {string} */
            this.name = settings.name || this.constructor.name;

            /** @type {Object.<string,KLF.DefaultLoader>} */
            this.fallbackLoaders = {};

            /** @type {Object.<string,KLF.ITokenProvider>} */
            this.tokenProviders = settings.tokenProviders;

            /** @type {KLF.ITokenProvider[]} */
            this.tokenProvidersSorted = [];
        }

        /**
         *
         * @param {string} extension The extension we are defining a fallback for
         * @param {KLF.DefaultLoader} callback The callback we should use if we fail
         */
        addDefaultLoader(extension, callback) {
            if (typeof callback !== 'undefined') {
                if (typeof callback !== 'function') {
                    this.log(`Loader ${this.name}: Callback for extension ${extension} MUST be a function`, LogDetailLevel.Error);
                }
                else if (extension in this.fallbackLoaders) {
                    this.log(`Loader ${this.name} already has fallback loader for extension ${extension}; Overwriting existing`, LogDetailLevel.Warning);
                }
                this.fallbackLoaders[extension] = callback;
            }
        }

        /**
         * Create an instance of our registered AstBuilder type
         * @param {Partial<KLF.IAstGenerator<KLF.IToken>>} options
         * @returns {KLF.IAstGenerator<any>}
         */
        createTreeBuilder(options) {
            if (!this.astGenerator)
                throw new Error(`ExtensionLoader ${this.name} did not define an AstGenerator`);
            const
                generator = new this.astGenerator({ ...options, loader: this });
            return generator;
        }

        /**
         * Record a message in the log
         * @param {string} message The message to record
         * @param {KLF.LogDetailLevel} detailLevel The sensitivity of the message
         * @param  {object} args Any additional arguments to pass
         */
        log(message, detailLevel, args) {
            this.manager.log(message, detailLevel, args);
        }

        /**
         * Attempt to use internal logic to load a module
         * @param {Module} module The module being loaded
         * @param {string} filename The name of the file the module is stored in
         */
        require(module, filename) {
            /**
             * Process:
             * (1) Read the file content,
             * (2) Tokenize the content,
             * (3) Compile results
             */
            const
                source = fs.readFileSync(filename, { encoding: this.encoding || 'utf8' }),
                treeBuilder = this.createTreeBuilder({ filename, source }),
                tokenRoot = treeBuilder.nextToken();
        }

        initialize() {
            if (typeof this.astGenerator !== 'function') {
                throw new Error(`Loader ${this.name} does not have a valid AstGenerator`);
            }

            this.tokenProvidersSorted = [];
            this.tokenProvidersById = {};
            let nextId = Number.MAX_SAFE_INTEGER - 1;

            for (const [name, type] of Object.entries(this.tokenProviders)) {
                const enumLookup = name.startsWith('Ast') ? name.slice(3) : name;
                let enumValue = TokenType[enumLookup], instance = undefined;

                if (typeof enumValue !== 'number') {
                    this.log(`Provider ${this.name} is using an AST provider '${name}' with a bogus ID`, LogDetailLevel.Warning);
                    enumValue = nextId--;
                }

                if (typeof type === 'function' && type.toString().startsWith('class ')) {
                    instance = new type({ name, loader: this, id: enumValue, tokenName: enumLookup });
                    this.tokenProvidersById[enumValue] = instance;
                    this.tokenProvidersSorted.push(instance);
                }
                else if (typeof type === 'object') {
                    instance = new AstTokenProvider({ name, ...type, id: enumValue, loader: this, tokenName: enumLookup });
                    this.tokenProvidersById[enumValue] = instance;
                    this.tokenProvidersSorted.push(instance);
                }
                else {
                    throw Error(`${this.name} provider initialization failed; AstProvider ${name} had invalid config`);
                }
            }
            this.tokenProvidersSorted.sort((a, b) => {
                if (a.weight > b.weight) return -1;
                else if (a.weight < b.weight) return 1;
                else return a.name.localeCompare(b.name);
            }).forEach((provider, index) => provider.index = index);
        }
    }

    class ExtensionLoaderJS extends ExtensionLoader {
        /**
         * Construct a loader for Javascript files
         * @param {ModuleManager} manager The ModuleManager singleton
         * @param {KLF.IExtensionLoader} settings The settings used to configure this loader
         */
        constructor(manager, settings) {
            super(manager, settings);
        }

        /**
         * Define a token provider
         * @param {string} name The unique provider name
         * @param {KLF.ITokenProvider} provider The provider
         */
        addTokenProvider(name, provider) {
            this.tokenProviders[name] = provider;
            return this;
        }

        /**
         *
         * @param {Partial<KLF.IAstGenerator<KLF.IToken>>} options
         * @returns {KLF.IAstGenerator<KLF.IToken>}
         */
        createTreeBuilder(options) {
            return new AstGeneratorJS({ ...options, loader: this });
        }

        /**
         * Attempt to use internal logic to load a module
         * @param {Module} module The module being loaded
         * @param {string} filename The name of the file the module is stored in
         */
        require(module, filename) {
            /**
             * Process:
             * (1) Read the file content,
             * (2) Tokenize the content,
             * (3) Run pipeline,
             * (4) Collate results
             * (5) Pass content off to Node's compiler
             */
            const
                source = fs.readFileSync(filename, { encoding: this.encoding || 'utf8' }),
                treeBuilder = this.createTreeBuilder({ filename, source, module, loader: this }),
                globalToken = treeBuilder.tokenize();
        }
    }

    /** @type {KLF.IExtensionLoader<ExtensionLoaderJS, KLF.IToken} */
    const test = ExtensionLoaderJS.defaultConfig = {
        astGenerator: AstGeneratorJS,
        enabled: true,
        extensions: [".js", ".jsx"],
        name: 'ExtensionLoaderJS',
        /** @type {Object.<string, KLF.ITokenProvider>} */
        tokenProviders: {
            AstAssignment,
            AstClass,
            AstCommentBlock,
            AstCommentInline,
            AstCurlyBrace,
            AstEquality,
            AstFunction,
            AstGlobal,
            AstIdentifier,
            AstNumber,
            AstParanthesis,
            AstSemicolon,
            AstWhitespace
        }
    }

    var foo = test.tokenProviders['test'];

    class ModuleManager extends events.EventEmitter {
        /**
         * Construct an extension-specific loader object
         * @param {KLF.IModuleManager} settings Settings to initialize this loader
         */
        constructor(settings = {}) {
            super();

            /** @type {KLF.LogDetailLevel} */
            this.debug = LogDetailLevel.tryParse(settings.debug || config.debug, LogDetailLevel.Error);

            /**
             * Maps file extensions to loader instance
             * @type {Object.<string,KLF.IExtensionLoader}
             */
            this.loaders = {};

            for (let [key, data] of Object.entries(settings.loaders)) {
                let instanceType = false, instance = false;

                if (false === data instanceof ExtensionLoader) {
                    if (typeof data === 'function' && data.toString().startsWith('class')) {
                        instanceType = data;
                        data = data.defaultConfig;
                    }
                    else if (typeof data !== 'object')
                        throw new Error(`${__filename}: Invalid loader configuration for '${key}'; Expects object or ExtensionLoader, not ${(typeof data)}`);
                    else if (false === key in ModuleManager.defaultConfig.loaders)
                        throw new Error(`${__filename}: Invalid loader configuration for '${key}'; ModuleManager does not define requested loader`);

                    const existingConfig = ModuleManager.defaultConfig.loaders[key],
                        loaderConfig = { ...settings, ...existingConfig, ...data };
                    instance = new instanceType(this, loaderConfig);
                    instance.initialize();
                }
                this.configureLoader(instance);
            }
        }

        /**
         * Configure an extension
         * @param {KLF.IExtensionLoader} loader The extension configuration
         * @returns
         */
        configureLoader(loader) {
            if (loader.extensions.length > 0) {
                for (const ext of loader.extensions) {
                    const
                        key = ext.charAt(0) === '.' ? ext : '.' + ext,
                        originalRequire = Module._extensions[key];

                    if (typeof originalRequire === 'undefined') {
                        this.log(`This NodeJS runtime does not recognize extension ${key}, but we will try and make it understand`, LogDetailLevel.Debug);
                    }
                    loader.addDefaultLoader(key, originalRequire);
                    /**
                     * Load a module
                     * @param {Module} module
                     * @param {string} filename The module file to load
                     */
                    Module._extensions[key] = (module, filename) => {
                        /** send the request back to the built-in handler */
                        const defer = (module, filename, message, detailLevel, arg = {}) => {
                            this.log(message, detailLevel, arg);
                            this.emit('deferred', { module, filename, message, ...arg });
                            return originalRequire(module, filename);
                        };
                        try {
                            if (loader.enabled) {
                                loader.log(`Starting load process for ${filename} using ${loader.name}`, LogDetailLevel.Verbose);

                                if (!loader.require(module, filename)) {
                                    if (typeof originalRequire === 'function')
                                        defer(module, filename, `Loader ${loader.name} is deferring ${filename} to built-in require()`, LogDetailLevel.Debug, { module, filename, loader });
                                    else {
                                        this.log(`Loader ${this.name} was unable to load ${filename} and there is no fallback for ${key}!!!`, LogDetailLevel.Error, { module, filename, loader });
                                        this.emit('failure', { module, filename, message: 'No reason given by loader' });
                                        return false;
                                    }
                                }
                                else /* we did our job */
                                    return true;
                            }
                            defer(module, filename, `Skipping load process for ${filename} using ${loader.name} [loader disabled]`, LogDetailLevel.Verbose);
                        }
                        catch (error) {
                            defer(module, filename, `Loader ${loader.name} failed to load ${filename}: Error: ${error}`, LogDetailLevel.Error, { filename, error, module });
                        }
                    };
                }
            }
            else {
                this.log(`Loader ${loader.name} does not provide any extensions and will do nothing`, LogDetailLevel.Warning, { loader });
            }
        }


        /**
         * Record a message in the log
         * @param {string} message The message to record
         * @param {KLF.LogDetailLevel} detailLevel The sensitivity of the message
         * @param {boolean} ignoreConfig If true, then this message is sent to the console even if it exceeds our logging threshold
         * @param  {object} args Any additional arguments to pass
         */
        log(message, detailLevel, ignoreConfig = false, args = undefined) {
            if (typeof ignoreConfig === 'object') {
                if (typeof args !== 'object')
                    args = ignoreConfig;
                ignoreConfig = false;
            }
            const debugLevel = DetailLevelString[detailLevel];
            const output = `+[${debugLevel}]: ${message}`;
            /** @type {KLF.LogMessageEventArgs} */
            const logArgs = { detailLevel, message, args, timestamp: Date.now(), ...args };

            if (this.debug >= detailLevel || ignoreConfig) {
                console.log(output);
            }
            if (typeof this.onLogMessage === 'function') {
                this.onLogMessage.call(extConfig, logArgs);
            }
            this.emit('logging', logArgs);
        }
        /**
         * Run module code through the pipeline and return the finished source to Node
         * @param {string} filename The filename of the module being loaded
         * @param {string} source The source text read in from the filename
         * @returns {string | false} Returns the modified source or false if the parsing failed
         */
        runPipeline(filename, source) {

        }
    }
    /** @type {ModuleManager} */
    ModuleManager.defaultConfig = {
        debug: LogDetailLevel.Error,
        enabled: true,
        exclude: [
            ...locateNodeModulesDirectory()
        ],
        loaders: {
            ExtensionLoaderJS
        }
    }

    /**
     * Tokenize some source code
     * @param {Readonly<string>} filename The name of the file being processed
     * @param {Readonly<string>} source The source code coming in
     * @param {Readonly<KLF.IExtensionLoader>} extConfig The extension configuration
     */
    function jsExpander(filename, source, extConfig) {
        let pos = 0,
            /** @type {KLF.ITokenizerContext} */
            context = {
                inArrowFunction: false,
                inAssignment: false,
                inParameterList: false,
                /** @type {KLF.IToken} */
                thisClass: false,
                /** @type {KLF.IToken} */
                thisMethod: false,
                /** @type {KLF.IToken} */
                thisFunction: false,
                scope: 'global',
                scopeVariables: {},
            },
            /** @type {KLF.ITokenizerContext[]} */
            contextStack = [context],
            /** @type {false | TokenType[]} */
            expected = false;

        const max = source.length,
            isWhitespace = (c) => /^\s+$/.test(c || source.charAt(pos)),
            eatWhitespace = () => {
                let c = source.charAt(pos);
                if (pos === max)
                    return false;
                else if (!isWhitespace(c))
                    return true;
                else {
                    /** @type {KLF.IToken} */
                    const result = { start: pos, type: TokenType.Whitespace };
                    while (isWhitespace(c)) {
                        pos++;
                        if (pos >= max)
                            return true;
                        c = source.charAt(pos);
                    }
                    result.end = pos - 1;
                    return result;
                }
            },
            nextChar = (a = false) => {
                eatWhitespace();
                if (a && source.slice(pos, pos + a.length) === a)
                    return (pos += a.length), a;
                else
                    return source.charAt(++pos)
            },
            endOfLine = (c) => { const n = source.indexOf('\n', pos); return n > -1 ? (pos = n + 1) : max; },
            expect = (tt) => {
                if (!Array.isArray(expected))
                    expected = [tt];
                else
                    expected.unshift(tt);
            };
        /** @returns {KLF.IToken} */
        isValidIdentifier = (c) => /[$A-Z_][0-9a-zA-Z_$]/.test(c),
            findLiteral = (expr, consume = false) => {
                const index = source.indexOf(expr, pos + 1);
                if (index === -1)
                    return -1;
                return index + (consume ? expr.length : 0);
            },
            outputBlocks = [],
            /**
             * Pop off and return the previous context
             * @returns {KLF.TokenizerContext}
             */
            popContext = () => {
                context = contextStack.shift();
                if (!context) {
                    extConfig.log(`CRITICAL: Encountered error while parsing ${filename}`);
                    throw new Error(`Parsing error in ${filename}`);
                }
                return context;
            },
            pushContext = (/** @type {KLF.ITokenizerContext} */ ctx, expectations = false) => {
                contextStack.unshift(context = { ...context, ...ctx });
                if (Array.isArray(expectations)) {
                    expected = expected ? [...expected, ...expectations] : expectations;
                }
                //  Return previous
                return contextStack[1];
            };

        /**
         * Read the next token from source
         * @param {TokenType} expectedType The type of token to expect; Throws error if mismatched
         * @returns {KLF.IToken}
         */
        const nextToken = function (expectedType = undefined) {
            /** @type {Partial<KLF.IToken>} */
            let token = { type: TokenType.Unknown };

            try {
                while (pos < max) {
                    if (!eatWhitespace())
                        return false;
                    else
                        token.start = pos;
                    let thisChar = source.charAt(pos),
                        thisCharCode = source.charCodeAt(pos),
                        take2 = source.slice(pos, pos + 1),
                        take3 = source.slice(pos, pos + 2);

                    switch (true) {
                        case isWhitespace(thisChar):
                            {
                                const ws = [];
                                do {
                                    ws.push(thisChar);
                                    if (!isWhitespace(thisChar = nextChar()))
                                        break;
                                } while (pos < max);
                                return { ...token, type: TokenType.Whitespace, end: pos, value: ws.join('') };
                            }

                        case /[$A-Za-z_]/.test(thisChar): // TODO add case for private vars
                            {
                                const id = [];
                                do {
                                    id.push(thisChar);
                                    if (!/[0-9a-zA-Z_$]/.test(thisChar = nextChar()))
                                        break;
                                } while (pos < max);

                                const value = id.join('');

                                if (context.inParameterList) {
                                    token = { ...token, type: TokenType.Parameter, end: token.start + value.length, name: value };
                                    context.scopeVariables[value] = true;
                                    eatWhitespace();
                                    if (source.charAt(pos) === '=') {
                                        //  Does this have a default value?
                                        if (!eatWhitespace())
                                            throw new Error(`Reached end of source while searching for default value for parameter '${value}' at position ${pos}`);
                                        token.assignment = nextToken();
                                        token.defaultValue = token.assignment.rhs.value;
                                        token.end = pos;
                                    }
                                    return token;
                                }
                                else
                                    switch (value) {
                                        case 'async':
                                            {
                                                //  Async method?  Async function?
                                            }
                                        case 'class':
                                            {
                                                if (!eatWhitespace())
                                                    throw new Error(`Reached end of source while searching for class name at position ${pos}`);
                                                const name = nextToken();
                                                if (nextChar('extends')) {
                                                    token.superClass = nextToken();
                                                    token.superClassName = token.superClass.name;
                                                }
                                                token.type = TokenType.Class;
                                                token.body = nextToken(TokenType.ClassBody);
                                                token.end = token.body.end;
                                                return token;
                                            }
                                        case 'constructor':
                                            token = { ...token, type: 'ClassConstructor', end: token.start + value.length, name: value, body: false };
                                            return token;
                                        case 'function':
                                            if (!eatWhitespace())
                                                throw new Error(`Reached end of source while searching for function name at position ${pos}`);
                                            break;
                                        case 'get':
                                        case 'set':
                                            break;
                                        default:
                                            return { ...token, type: TokenType.Identifier, end: token.start + value.length, value };
                                    }
                            }

                        case thisCharCode > 47 && thisCharCode < 58:
                            {
                                let notation = 'decimal';
                                if (thisChar === '0') {
                                    if (nextChar('x'))
                                        notation = 'hex';
                                    else if (nextChar('b') || nextChar('B'))
                                        notation = 'binary';
                                    else if (nextChar('o'))
                                        notation = 'octal';
                                }
                                const end = source.slice(pos).search(/[^\d+]+/);
                                token.end = (pos += end);
                                token.type = TokenType.Number;
                                token.value = source.slice(token.start, token.end);
                                token.notation = notation;
                                return token;
                            }

                        case thisChar === '=':
                            token = { ...token, type: 'Assignment', end: ++pos, operator: '=' };
                            eatWhitespace();
                            token.rhs = nextToken();
                            return token;


                        case take2 === '*=':
                        case take2 === '/=':
                        case take2 === '+=':
                        case take2 === '-=':
                        case take2 === '|=':
                        case take2 === '&=':
                        case take2 === '%=':
                        case take2 === '^=':
                            token = { ...token, type: 'Assignment', end: pos += 2, operator: take2 };
                            return token.rhs = nextToken(), token;

                        case take3 === '**=':
                        case take3 === '<<=':
                        case take3 === '>>=':
                        case take3 === '&&=':
                        case take3 === '||=':
                        case take3 === '??=':
                            token = { ...token, type: 'Assignment', end: pos += 3, operator: take2 };
                            return token.rhs = nextToken(), token;

                        case thisChar === '{':
                            {
                                if (expectedType) {
                                    switch (expectedType) {
                                        case TokenType.ClassBody:
                                            {
                                                token.children = [];
                                                token.type = expectedType;
                                                let stmt = nextToken();
                                                while (stmt.TokenType !== TokenType.BlockStatementEnd) {
                                                    token.children.push(stmt);
                                                }
                                                token.end = stmt.end;
                                                return token;
                                            }
                                    }
                                }
                                else {
                                    token.type = TokenType.BlockStatement;
                                }

                                if (expectedType) {
                                    switch (expectedType) {

                                    }
                                    switch (context.scope) {
                                        case 'class':
                                            return (context.thisClass.body = { ...token, type: TokenType.ClassBody, end: pos });

                                        case 'member':
                                            {
                                                /** @type {KLF.IToken} */
                                                const memberBody = { ...token, type: 'MemberBody', end: pos, children: [] };
                                                context.thisMember.body = memberBody;
                                                let stmt = nextToken();
                                                while (stmt.type !== 'MemberBodyEnd') {
                                                    memberBody.children.push(stmt);
                                                }
                                                return memberBody;
                                            }
                                    }
                                }
                            }
                            break;

                        case thisChar === '}':
                            // End code block
                            break;

                        case thisChar === '(':
                            {
                                let paramToken = false,
                                    parentContext = pushContext({ inParameterList: true });

                                token = { ...token, type: TokenType.ParameterList, params: [], start: pos++ };
                                while ((paramToken = nextToken()) && paramToken.type !== 'ParamListEnd') {
                                    token.params.push(paramToken);
                                    parentContext.scopeVariables[paramToken.name] = paramToken.defaultValue;
                                }
                                popContext();
                                token.end = paramToken.end;
                                return token;
                            }
                            break;

                        case thisChar === ')':
                            {
                                return { ...token, type: TokenType.ParameterList, end: ++pos };
                            }
                            break;
                        case '`':
                            //  Templated string
                            {

                            }
                        case thisChar === '/':
                            {
                                //  Could be operator or possible comment
                                const nc = nextChar();

                                if (nc === '/') {
                                    //  Single line comment
                                    const end = endOfLine();
                                    const result = { ...token, type: TokenType.CommentInline, end };
                                    return result;
                                }
                                else if (nc === '*') {
                                    //  Comment block
                                    const end = findLiteral('*/', true);
                                    if (end === -1) {
                                        throw new Error(`Reached end of source while searching for end of comment starting at ${pos}`);
                                    }
                                    const result = { ...token, type: TokenType.CommentBlock, end };
                                    pos = end;
                                    return result;
                                }
                            }
                            break;


                    }
                }
                return false;
            }
            finally {
                if (expectedType) {
                    throw new Error(`Unexpected token ${TokenType[token.type]}; Expected ${TokenType[expectedType]}`);
                }
                if (typeof token.end !== 'number') {
                    throw new Error(`Token ${TokenType[token.type]} starting at position ${token.start} did not set an end position`);
                }
            }
        }

        try {
            /** @type {KLF.IToken} */
            let token = false, lastPos = -1;

            while (token = nextToken()) {
                //  We seem to be stuck in a loop...
                if (pos === lastPos)
                    return extConfig.log(`Stuck in endless loop around position ${pos}; Aborting`);
                else if (token.start > lastPos) {
                    const ws = source.slice(lastPos, token.start);
                    if (!isWhitespace(ws)) {
                        return extConfig.log(`Unexpected token at position ${pos}: ...${ws.slice(0, 20)}`);
                    }
                    ws && outputBlocks.push(ws);
                }
                if (token.start < token.end)
                    token.value = source.slice(token.start, token.end);
                else // should not happen, right?
                    token.value = '';

                if (expected && token.type !== 'Whitespace') {
                    if (expected[0] !== token.type)
                        return extConfig.log(`Unexpected token at position ${token.start}; Expected ${expected[0]} but got ${token.type}`, LogDetailLevel.Error);
                    expected.shift();
                    if (expected.length === 0) expected = false;
                }

                switch (token.type) {
                    case 'ClassBegin':
                        pushContext({ thisClass: token, scope: 'class' })
                        break;
                    case 'ClassConstructor':
                        pushContext({ thisMember: token, scope: 'member' }, ['ParamList', 'MemberBody']);
                        break;
                    case 'ClassEnd':
                        popContext();
                        break;
                    case 'CommentInline':
                        if (extConfig.expandComments === true) {

                        }
                        break;
                    case 'ParamList':
                        break;
                }

                token.value && outputBlocks.push(token.value);
                lastPos = pos;
            }
            return true;
        }
        catch (err) {
            if (err.message)
                return extConfig.log(err.message, LogDetailLevel.Error);
            else if (typeof err === 'string')
                extConfig.log(message, LogDetailLevel.Error);
            else
                extConfig.log(`An error occured while parsing ${filename} around position ~${pos}`, LogDetailLevel.Error);
        }
    }

    /**
     * Configure the preprocessor for a list of extensions.
     * @param {KLF.ExternalFunctionNames | Partial<KLF.IModuleManager>} configData The list of extensions to configure
     * @param {{ manager: Partial<KLF.IModuleManager>, loader: Partial<KLF.IExtensionLoader>}} data
     */
    module.exports = function (configData = {}, { manager, loader } = {}) {
        if (typeof configData === 'string') {
            if (configData.charAt(0) === '_')
                throw new Error(`Permission to method '${configData}' denied; Underscore methods are protected`);
            else if (configData === 'init') {
                if (typeof manager !== 'object')
                    throw new Error(`Missing parameter for '${configData}'; Requires KLF.IModuleManager object`);
                config = new ModuleManager(manager);
            }
        }
        else if (typeof configData === 'object') {
            const config = mergeConfigs({}, ModuleManager.defaultConfig, configData),
                manager = new ModuleManager(config);
            return {
                createEnum,
                ModuleManager: manager
            };
        }
    }
}
catch (err) {
    console.log(`${__filename} failed to load middleware`);
}