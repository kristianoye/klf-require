
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
