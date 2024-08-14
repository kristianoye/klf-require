/*
 *  Documentation for the KLF module loader middleware
 *  Written by Kristian Oye <kristianoye@gmail.com> 
 */
declare module 'klf-importer' {
    import { EventEmitter } from 'events';
    import Module from 'module';

    global {
        export namespace KLF {
            /** Points to the original require implementation for a particular extension */
            export type DefaultLoader = (module: Module, filename: string) => any;
            export type EnumType = 'bitflag'
                | 'number'
                | 'string';

            /** Manager functions exposed to the outside world */
            export type ExternalFunctionNames = 'add'
                | 'ast'
                | 'config'
                | 'disable'
                | 'enable'
                | 'get'
                | 'init'
                | 'remove'
                | 'update';

            export type NextTokenResult<TTokenType> = boolean | { nextToken?: TTokenType[], token: TTokenType };

            export interface IImportLogger extends EventEmitter {
                /** 
                 * Write a log message 
                 * @param message The message to record
                 * @param detailLevel The severity of the message
                 * @param logData Additional logging information
                 */
                log(message: string, detailLevel: LogDetailLevel, logData?: Map<string, any>): this;
            }

            export interface IAstGenerator<TTokenType = IToken> extends IImportLogger {
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
                getProviderById(tokenType: TokenType): ITokenProvider<TTokenType>;

                /**
                 * Get a token provider by name
                 * @param name The name of the provider
                 */
                getProviderByName(name: string): ITokenProvider<TTokenType>;

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
                pipeline: ITokenProvider<TTokenType>[];

                /**
                 * Prepare a provider pipeline for the current call to nextToken()
                 * @param expected An explicit list of token types to expect from nextToken()
                 */
                preparePipeline(...expected: TokenType[]): ITokenProvider[];

                /** A name-based lookup of token providers */
                providers: Map<string, ITokenProvider<TTokenType>>;

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
                removeProvider(provider: ITokenProvider<TTokenType>): boolean;

                /** Tokenize the source code */
                tokenize(): TTokenType;

                /** Token providers mapped by name */
                readonly tokenProviders: Map<string, ITokenProvider<TTokenType>>;

                /** Token providers mapped by numeric ID */
                readonly tokenProvidersById: Map<TokenType, ITokenProvider<TTokenType>>;

                /** Token providers sorted by weight */
                readonly tokenProvidersSorted: ITokenProvider<TTokenType>[];

                tryRead(assertText: string): NextTokenResult<TTokenType>;

                /** Update the position based on the state of the token */
                updatePosition(token: TTokenType, leaveOpen: boolean): SourcePosition;
            }

            export type GetTokenCallback<TTokenType = IToken> = (parent: IAstGenerator<TTokenType>, context: ITokenizerContext, testResult?: any) => { token: TTokenType, nextToken: TokenType[], leaveOpen?: boolean };
            export type TestTokenCallback<TTokenType = IToken> = (ast: IAstGenerator<TTokenType>, context: ITokenizerContext) => boolean | string | RegExpExecArray;
            export type TokenProviderCondition<TTokenType = IToken> = string | RegExp | ((parent: IAstGenerator<TTokenType>, context: ITokenizerContext) => any)

            /** Contains the logic to create a single token type */
            export interface ITokenProvider<TTokenType = IToken> {
                condition?: TokenProviderCondition<TTokenType>;

                /** For default getToken() functionality, we need to know what kind of token we are creating */
                tokenType?: TTokenType | false;

                /** 
                 * The callback to actually generate the token 
                 * @param ast The builder creating the AST
                 * @param context The current tokenizer context
                 */
                getToken(ast: IAstGenerator<TTokenType>, context: ITokenizerContext, testResult?: any): TTokenType;

                /** Numerical ID that should map back to the token type enum */
                id: number;

                /** Index assigned to the instance */
                readonly index: number;

                /** The friendly name of this component */
                name: string;

                /** Value used when sorting this provider with other providers */
                weight: number;

                /** Test to see if this provider should be used given the current context */
                test(parent: IAstGenerator<TTokenType>, context: ITokenizerContext): boolean;
            }

            /** Contains details on how to load a particular exteion, e.g. '.js' files */
            export interface IExtensionLoader<TAst, TToken = IToken> extends IImportLogger {
                /** Designate the fallback loader if we fail */
                addDefaultLoader(extension: string, require: DefaultLoader): void;

                astGenerator: IAstGenerator<TAst>;

                /** Is this loader enabled? */
                enabled: boolean;

                /** Directories to exclude from the loader logic */
                exclude?: LoaderFilterList[];

                /** One or more extensions to associate with this loader */
                extensions: string[];

                /** Directories to explicitly include in the loader logic */
                include?: LoaderFilterList[];

                /** Initialize the loader */
                initialize(): void;

                /** The name of the loader */
                readonly name: string;

                /** Optional callback to check if a file should be be skipped by the loader */
                onExclude?: LoaderFilterCallback;

                /** Optional callback to see if a particular module should be loaded */
                onInclude?: LoaderFilterCallback;

                /** Optional callback for logging events*/
                onMessage?: LogMessageCallback;

                /** Ordered pipeline used to pre-parse module source */
                pipeline: PipelineComponent[];

                require(module: object, filename: string): void;

                /** Modules configured to create AST from source code */
                tokenProviders: Map<string, ITokenProvider<TToken>>;

                /** Modules mapped by their token id  */
                tokenProvidersById: Map<TokenType, ITokenProvider<TToken>>;

                /** Providers ordered by specificity (highest to lowest) */
                tokenProvidersSorted: ITokenProvider<TToken>[];
            }

            /** The top level component creates, configures, and manages extension loaders. */
            export interface IModuleManager extends IImportLogger {
                /**
                 * Add a new extension loader
                 * @param component The new extension loader
                 */
                add(component: IExtensionLoader<any, any>): boolean;

                /** 
                 * Generate AST for a particular file
                 */
                ast(filename): object;

                /**
                 * Updates configuration data for a loaded component
                 * @param data Module data to import
                 */
                config(ext: string, setter: (loaderConfig: IExtensionLoader<any, any>) => boolean): boolean;

                /**
                 * Initialize the loader middleware; This nukes any existing config
                 * @param data The initial module configuration
                 */
                init(data: IModuleManager): boolean;

                /** How sensitive is our logger? */
                debug?: LogDetailWord | LogDetailLevel;

                /** Is this component enabled? */
                enabled: boolean;

                /** Loaders responsible for trying to import modules */
                loaders: Map<string, IExtensionLoader<any, any>>;

                /** Optional callback to check if a file should be be skipped by the loader */
                onExclude?: LoaderFilterCallback;

                /** Optional callback to see if a particular module should be loaded */
                onInclude?: LoaderFilterCallback;

                /** Optional callback for logging events*/
                onMessage?: LogMessageCallback;
            }

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

            /** Various level of logging detail */
            export enum LogDetailLevel {
                /** Provides the highest level of detail */
                Verbose,
                /** Debug provides slightly less detail than Verbose */
                Debug,
                /** Display errors and warnings */
                Warnings,
                /** Only display actual errors */
                Errors,
                /** No console logging at all */
                None
            }

            /** Human friendly version of LogDetailLevel */
            export type LogDetailWord = 'None'
                | 'Errors'
                | 'Warnings'
                | 'Debug'
                | 'Verbose';

            export interface LogMessageEventArgs {
                detailLevel: LogDetailLevel;
                extension: string;
                message: string;
                timestamp: number;
                args?: Map<string, any>;
            }

            export type LoaderFilter = string | ((filename: string) => boolean);
            export type LoaderFilterAction = 'Included' | 'Excluded';
            export type LoaderFilterCallback = (filename: string, filter: LoaderFilter, action: LoaderFilterAction) => void;
            export type LoaderFilterList = LoaderFilter[];
            export type LogMessageCallback = (logEntry: LogMessageEventArgs) => void;
            export type PipelineComponent = (filename: string, source: string, config: IExtensionLoader<any, any>) => string | boolean;

            /** Describes the location of a token within the source file  */
            export type SourcePosition = {
                /** The zero-based line number in the original source */
                line: number,
                /** The zero-based offset from the beginning of the file */
                char: number,
                /** The zero-based column number in the original line */
                col: number
            };

            export enum TokenizerScope {
                ArrowFunction,
                Class,
                Function,
                Global,
                Member
            }
            export enum TokenType {
                Unknown,
                ArrowFunction,
                Assignment,
                BlockStatement,
                CurlyBrace,
                Class,
                ClassBody,
                CommentBlock,
                CommentInline,
                Equality,
                Function,
                Identifier,
                Member,
                Number,
                Parameter,
                ParameterList,
                Paranthesis,
                RawText,
                ReservedWord,
                Semicolon,
                Whitespace
            }

        }
    }
}