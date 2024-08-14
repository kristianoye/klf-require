/// <reference path="ast.d.ts" />
declare module 'loader' {
    global {
        export namespace KLF {
            //#region Types

            /** Contains all the loader types known by the system */
            export type ExtensionLoaderCollection = Map<string, IExtensionLoader>;

            /** Points to the original require implementation for a particular extension */
            export type NativeRequireLoader = (module: Module, filename: string) => any;

            //#endregion

            //#region Interfaces

            /** Contains details on how to load a particular exteion, e.g. '.js' files */
            export interface IExtensionLoader<TAst = IAstBuilder, TToken = IToken> extends IImportLogger {
                /** Designate the fallback loader if we fail */
                addDefaultLoader(extension: string, require: NativeRequireLoader): void;

                astGenerator: IAstBuilder<TAst>;

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
                tokenProviders: Map<string, IAstGenerator<TToken>>;

                /** Modules mapped by their token id  */
                tokenProvidersById: Map<TokenType, IAstGenerator<TToken>>;

                /** Providers ordered by specificity (highest to lowest) */
                tokenProvidersSorted: IAstGenerator<TToken>[];
            }

            //#endregion
        }
    }
}