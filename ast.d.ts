/// <reference path="common.d.ts" />
/// <reference path="loader.d.ts" />
/// <reference path="manager.d.ts" />
declare module 'ast' {
    global {
        export namespace KLF {
            //#region AST Callbacks

            export type GetTokenCallback<TTokenType = IToken> = (parent: IAstBuilder<TTokenType>, context: ITokenizerContext, testResult?: any) => { token: TTokenType, nextToken: TokenType[], leaveOpen?: boolean };

            export type TestTokenCallback<TTokenType = IToken> = (ast: IAstBuilder<TTokenType>, context: ITokenizerContext) => boolean | string | RegExpExecArray;

            export type AstGeneratorCondition<TTokenType = IToken> = string | RegExp | ((parent: IAstBuilder<TTokenType>, context: ITokenizerContext) => any);

            /** Contains all the loader types known by the system */
            export type AstBuilderCollection = Map<string, IAstBuilder>;

            /** Contains all the loader types known by the system */
            export type AstGeneratorCollection = Map<string, IAstGenerator>;


            //#endregion

            //#region AST Interfaces

            /** Implemented by single-use objects that create abstract syntax trees */
            export interface IAstBuilder<TTokenType = IToken> extends IImportLogger {
                /** A flat array of all tokens created, in the order they were created */
                allTokens: TTokenType[];

                /** The name of the file being parsed */
                readonly filename?: string;

                readonly loader: IExtensionLoader<any, TTokenType>;

                readonly manager: IModuleManager;

                /** Clone the current position */
                clonePosition(): SourcePosition;

                /**
                 * Check to see if the current position contains the supplied text
                 * @param expected The text we are expecting to eat
                 */
                eatText(expected: string, advancePosition?: true): TTokenType | boolean;

                /** 
                 * Eats whitespace and returns a Whitespace token or boolean if none was found 
                 */
                eatWhitespace(): TTokenType | boolean;

                /** Update position and finish/validate the token */
                endToken(token: TTokenType): TTokenType;

                /**
                 * Get a token provider by enum value/ID
                 * @param tokenType The type of provider we want
                 */
                getProviderById(tokenType: TokenType): IAstGenerator<TTokenType>;

                /**
                 * Get a token provider by name
                 * @param name The name of the provider
                 */
                getProviderByName(name: string): IAstGenerator<TTokenType>;

                /**
                 * Fetch the string representation of the provider's enumerical value
                 * @param tokenType The numeric token ID
                 */
                getProviderTokenName(tokenType: TokenType): string;

                /** Are we at the end of file? */
                isEOF(): boolean;

                /** Was the current character escaped? */
                isEscaped(): boolean;

                /**
                 * Language features and their enabled states
                 */
                languageFeatures: Map<string, boolean>;

                /**
                 * Get the next token from source
                 * @param expected An optional list of token types we should expect
                 */
                nextToken(...expect: TTokenType[]): { token: TTokenType, nextToken: TTokenType[] };

                /** Elements that have yet to be closed */
                openTokens: TTokenType[];

                /** An ordered list of token providers */
                pipeline: IAstGenerator<TTokenType>[];

                /**
                 * Prepare a provider pipeline for the current call to nextToken()
                 * @param expected An explicit list of token types to expect from nextToken()
                 */
                preparePipeline(...expected: TokenType[]): IAstGenerator[];

                /** A name-based lookup of token providers */
                providers: Map<string, IAstGenerator<TTokenType>>;

                /** Push new context data to the stack; Returns the previous state */
                pushContext(newContext: Partial<ITokenizerContext>): ITokenizerContext;

                /** The current parse location in the document */
                position: SourcePosition;

                /** Returns the remaining source after the current position */
                readonly remainder: string;

                /** The source code read from the file */
                readonly source: string;

                /** Start a new token */
                startToken(part: Partial<TTokenType>): TTokenType;

                /** Remove a provider... good for single-use providers like global */
                removeProvider(provider: IAstGenerator<TTokenType>): boolean;

                /** Tokenize the source code */
                tokenize(): TTokenType;

                /** Token providers mapped by name */
                readonly tokenProviders: Map<string, IAstGenerator<TTokenType>>;

                /** Token providers mapped by numeric ID */
                readonly tokenProvidersById: Map<TokenType, IAstGenerator<TTokenType>>;

                /** Token providers sorted by weight */
                readonly tokenProvidersSorted: IAstGenerator<TTokenType>[];

                tryRead(assertText: string): NextTokenResult<TTokenType>;

                /** Update the position based on the state of the token */
                updatePosition(token: TTokenType, leaveOpen: boolean): SourcePosition;
            }

            /** Represents a language construct in a source file */
            export interface IToken {
                /** The block that is the token's body (if any) */
                body?: IToken;

                /** Child tokens */
                children?: IToken[];

                /** Where this token ended within its source document */
                end: SourcePosition;

                /** Indicates the order in which the token was created */
                index: number;

                /** Indicates the where this token is in terms of the order it was created; 0 = first */
                ordinal: number;

                /** Identifier name */
                name?: string;

                /** Where this token starts within its source document */
                start: SourcePosition;

                /** The type of token @see {TokenType} */
                type: TokenType;

                /** A token value, if any */
                value: string;

                /** The raw source from the defining file */
                raw: string;

                /** The superclass token, if any */
                superClass?: IToken;

                /** The name of the superclass */
                superClassName?: string;

                /** The friendly token name from the TokenType enum */
                readonly tokenName?: string;
            }

            /** Contains the logic to create a single token type */
            export interface IAstGenerator<TTokenType = IToken> {
                condition?: AstGeneratorCondition<TTokenType>;

                /** For default getToken() functionality, we need to know what kind of token we are creating */
                tokenType?: TTokenType | false;

                /** 
                 * The callback to actually generate the token 
                 * @param ast The builder creating the AST
                 * @param context The current tokenizer context
                 */
                getToken(ast: IAstBuilder<TTokenType>, context: ITokenizerContext, testResult?: any): TTokenType;

                /** Numerical ID that should map back to the token type enum */
                id: number;

                /** Index assigned to the instance */
                readonly index: number;

                /** The friendly name of this component */
                name: string;

                /** Value used when sorting this provider with other providers */
                weight: number;

                /** Test to see if this provider should be used given the current context */
                test(parent: IAstBuilder<TTokenType>, context: ITokenizerContext): boolean;
            }

            export interface ITokenizerContext {
                /** The next, non-whitespace tokens to expect */
                expect?: TokenType[];
                /** Are we an annonymous function? */
                inAnonymousFunction: boolean;
                /** Are we parsing an arrow function? */
                inArrowFunction: boolean;
                /** Are we assigning a variable? */
                inAssignment: boolean;
                /** Are we parsing function parameters? */
                inParameterList: boolean;
                /** The DOM scope */
                scope: TokenizerScope;
                /** Native variables in the current scope */
                scopeVariables: Map<string, IToken>;
                /** The class we are defining */
                thisClass?: IToken;
                /** The function we are defining */
                thisFunction?: IToken;
                /** The class member we are defining */
                thisMember?: IToken;
            }

            //#endregion

            //#region AST type definitions

            /** The result type returned by AST generators */
            export type NextTokenResult<TTokenType> = boolean | { nextToken?: TTokenType[], token: TTokenType };

            /** Points to a specific location in a source file */
            export type SourcePosition = {
                /** The zero-based line number in the original source */
                line: number,
                /** The zero-based offset from the beginning of the file */
                char: number,
                /** The zero-based column number in the original line */
                col: number
            };

            /** A tokenizer scope */
            export enum TokenizerScope {
                ArrowFunction,
                Class,
                Function,
                Global,
                Member
            }

            /** Indicates the specific type of an AST node */
            export enum TokenType {
                /** The token type could not be determined */
                Unknown,
                /** An ES6 arrow function, e.g. () => true */
                ArrowFunction,
                /** An assignment operator, e.g. =, -=, >>>=, etc */
                Assignment,
                /** A block statement */
                BlockStatement,
                /** A curly brace: { or } */
                CurlyBrace,
                /** A class definition */
                Class,
                /** A class body? @deprecated */
                ClassBody,
                /** A comment block; Possibly multilined */
                CommentBlock,
                /** An inline comment block; Extends to end of line */
                CommentInline,
                /** An equality operator */
                Equality,
                /** A function declaration */
                Function,
                /** An identifier (word) */
                Identifier,
                /** A class member definition */
                Member,
                /** A numeric literal expression */
                Number,
                /** A method parameter */
                Parameter,
                /** An ordered collection of parameters */
                ParameterList,
                /** A paran: ( or ) */
                Paranthesis,
                /** Raw text... no parsing */
                RawText,
                /** A reserved word: for, while, etc */
                ReservedWord,
                /** An end of statement token */
                Semicolon,
                /** Some whitespace */
                Whitespace
            }

            //#endregion
        }
    }
}