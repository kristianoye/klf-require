/// <reference path="common.d.ts" />
/// <reference path="loader.d.ts" />
declare module 'manager' {
    global {
        export namespace KLF {
            export interface IAstComponentConfig<T> {
                name: string;
                type: T;
                config?: Map<string, any>;
            }

            export interface IAstConfigSection {
                /** The base type for all AST builders */
                baseBuilderType: IAstBuilder;

                /** The base type for all AST generators */
                baseGeneratorType: IAstGenerator;

                builders: Map<string, IAstComponentConfig<IAstBuilder>>;

                generators: Map<string, IAstComponentConfig<IAstGenerator>>;
            }

            /** The top level component creates, configures, and manages extension loaders. */
            export interface IModuleManager extends IImportLogger {
                /**
                 * Add a new extension loader
                 * @param component The new extension loader
                 */
                add(component: IExtensionLoader<any, any>): boolean;

                /** 
                 * Contains info about the AST subsystem
                 */
                ast: IAstConfigSection;

                /** A superset of all loaded components */
                components: Map<string, IAstBuilder | IAstGenerator | IExtensionLoader>;

                /**
                 * Updates configuration data for a loaded component
                 * @param data Module data to import
                 */
                config(ext: string, setter: (loaderConfig: IExtensionLoader<any, any>) => boolean): boolean;

                /** Enumerate component types within the library */
                enumerateTypes(directory: string, pattern: string | RegExp): any[];

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
                loaders: Map<string, IExtensionLoader>;

                /** Optional callback to check if a file should be be skipped by the loader */
                onExclude?: LoaderFilterCallback;

                /** Optional callback to see if a particular module should be loaded */
                onInclude?: LoaderFilterCallback;

                /** Optional callback for logging events*/
                onMessage?: LogMessageCallback;
            }

            /**
             * A callback that passes the existing config in to allow for updates.  If
             * the callback returns an object, it is assumed to be an entirely new config.
             */
            export type ExtendConfigCallback = (update: IModuleManager) => IModuleManager;

            /**
             * A callback that passes in an object of all known component types.  This allows a
             * consumer to extend existing types or define entirely new types.
             */
            export type ExtendTypesCallback = (components: ComponentCollection) => IComponent | ComponentCollection;

            /**
             * Provides a secure wrapper around the internal module manager
             */
            export interface IModuleManagerWrapper extends IImportLogger {
                /** Is require middleware enabled? */
                enabled: boolean;

                /** Extend one or more types */
                extendTypes(callback: ExtendTypesCallback): this;

                /**
                 * Update the active configuration and continue
                 * @param callback A callback to allow the user to change settings
                 */
                updateConfig(callback: ExtendConfigCallback): this;
            }
        }
    }
}