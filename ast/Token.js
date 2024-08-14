/** 
 * @type {KLF.IToken} 
 * @class
 */
/** 
 * @implements {KLF.IToken}
 */
class Token {
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

module.exports = Token;
