declare module 'common' {
    import { EventEmitter } from 'events';
    global {
        export namespace KLF {
            //#region Enums

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

            //#endregion

            //#region Types

            /** A collection of all known component types */
            export type ComponentCollection = Map<string, IComponentEntry>;

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

            /** Human friendly version of LogDetailLevel */
            export type LogDetailWord = 'None'
                | 'Errors'
                | 'Warnings'
                | 'Debug'
                | 'Verbose';

            export type LogMessageCallback = (logEntry: LogMessageEventArgs) => void;

            export type LoaderFilter = string | ((filename: string) => boolean);

            export type LoaderFilterAction = 'Include' | 'Exclude';

            export type LoaderFilterCallback = (filename: string, filter: LoaderFilter, action: LoaderFilterAction) => void;

            export type LoaderFilterList = LoaderFilter[];

            //#endregion

            //#region Interfaces

            export interface IComponent<TType extends new (...args: any[]) => any = any> {
                /** Get the default config for the type */
                getDefaultConfig(config: IModuleManager): Partial<TType>;
            }

            export interface IComponentEntry<TType extends new (...args: any[]) => any = any> {
                /** Default configuration data to pass to a newly created instance of this type */
                config: object,

                /** The name for this component; May be different than the underlying type name */
                name: string;

                /** A reference to the actual implementing type */
                type: IComponent<TType>;
            }

            /** Common interface inherited by various components in the library */
            export interface IImportLogger extends EventEmitter {
                /** 
                 * Write a log message 
                 * @param message The message to record
                 * @param detailLevel The severity of the message
                 * @param logData Additional logging information
                 */
                log(message: string, detailLevel: LogDetailLevel, logData?: Map<string, any>): this;
            }

            /** Event type emitted by logger */
            export interface LogMessageEventArgs {
                detailLevel: LogDetailLevel;
                extension: string;
                message: string;
                timestamp: number;
                args?: Map<string, any>;
            }

            //#endregion
        }
    }
}