'use strict';
const ConfigUtil = require('./util/ConfigUtil');
const ObjectUtil = require('./util/ObjectUtil');
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
/// <reference path="index.d.ts" />

const PathUtil = require('./util/PathUtil'),
    { LogDetailLevel } = require('./Constants'),
    { EventEmitter } = require('events'),
    AstBuilder = require('./ast/AstBuilder'),
    GeneratorBase = require('./ast/generators/GeneratorBase'),
    ExtensionLoader = require('./loader/ExtensionLoader'),
    path = require('path'),
    fs = require('fs');

/**
 * @implements {KLF}
 */
class ModuleManager extends EventEmitter {
    /**
     * Construct an extension-specific loader object
     * @param {KLF.IModuleManager} settings Settings to initialize this loader
     */
    constructor(settings = {}) {
        super();

        /** @type {KLF.LogDetailLevel} */
        this.debug = LogDetailLevel.tryParse(settings.debug || activeConfig.debug, LogDetailLevel.Error);
        this.settings = settings;
        this.components = {
            ...settings.ast.baseBuilderType,
            ...settings.ast.baseGeneratorType,
            ...this.builderTypes,
            ...this.generatorTypes,
            ...settings.loaders
        };
    }

    /**
     * 
     * @param {Partial<KLF>} config 
     */
    applyConfigChange(config) {
        try {
            this.emit('configChangeStart', config);
            this.settings = ConfigUtil.mergeConfigs({}, this.settings, config);
        }
        catch (err) {
            this.log(`Failed to update active configuration; Error = ${err}`, LogDetailLevel.Error);
        }
    }

    bootstrap() {
        for (const [loaderId, loaderType] of Object.entries(this.loaders.instanceTypes)) {
            this.log(`Creating runtime instance of ${loaderId}`, LogDetailLevel.Debug);
        }
    }

    get builderTypes() {
        const result = {};
        for (const [id, entry] of Object.entries(this.settings.ast.builders)) {
            result[id] = entry.type;
        }
        return result;
    }

    get generatorTypes() {
        const result = {};
        for (const [id, entry] of Object.entries(this.settings.ast.generators)) {
            result[id] = entry.type;
        }
        return result;
    }

    get loaders() {
        const result = {};
        for (const [id, entry] of Object.entries(this.settings.loaders)) {
            result[id] = entry.type;
        }
        return result;
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
     * Get the default/startup configuration
     * @returns {Partial<KLF.IModuleManager>}
     */
    static getDefaultConfig() {
        /** @type {Partial<KLF.IModuleManager>} */
        const config = {
            debug: LogDetailLevel.None,
            enabled: false,
            exclude: [
                ...PathUtil.locateNodeModulesDirectory()
            ],
            include: [
            ],
            ast: {},
            loaders: {}
        };

        AstBuilder.enumerateBuiltinTypes(config);
        ExtensionLoader.enumerateBuiltinTypes(config);

        return config;
    }

    /**
     * Check to see if the given type might be useful in our system
     * @param {any} type The type to inspect
     * @returns True if the component is a known subtype
     */
    isUsefulComponent(type) {
        if (ObjectUtil.isClass(type))
            return type.prototype instanceof AstBuilder
                || type.prototype instanceof this.settings.ast.baseGeneratorType
                || type.prototype instanceof ExtensionLoader;
        else
            return false;
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

const manager = new ModuleManager(ModuleManager.getDefaultConfig());

class ModuleManagerSafeWrapper extends EventEmitter {
    constructor() {
        super();
    }

    get enabled() { return manager.settings.enabled; }

    set enabled(flag) { manager.settings.enabled = flag === true; }

    /**
     * Hook for extending component types
     * @param {ExtendTypesCallback} callback The callback executed to extend types
     * @returns 
     */
    extendTypes(callback) {
        const newType = callback({ ...manager.components });

        if (typeof newType === 'object') {
            for (const [name, typeDef] of Object.entries(newType)) {
                this.registerComponent(typeDef, name);
            }
        }
        else if (ObjectUtil.isClass(newType))
            this.registerComponent(newType);
        return this;
    }

    log(...args) {
        return manager.log(...args);
    }

    on(...args) {
        this.on(...args);
    }

    /**
     * Register a new component
     * @param {KLF.IComponent} type The type to register
     * @param {string?} altName An alternate name for the type
     * @returns Reference to this object
     */
    registerComponent(type, altName) {
        if (manager.isUsefulComponent(type)) {
            const parentTypeName = ObjectUtil.parentClassName(type);
            const altTypeName = typeof altName === 'string' && altName.trim();
            /** @type {KLF.IComponentEntry} */
            const existing = parentTypeName in manager.components && manager.components[parentTypeName];
            /** @type {KLF.IComponentEntry} */
            const newEntry = {
                type,
                name: type.name,
                config: { ...(typeof type.getDefaultConfig === 'function' && type.getDefaultConfig(manager.settings) || {}) }
            };

            if (false === type.name in manager.components) {
                manager.components[type.name] = type;
            }
            if (existing) {
                manager.components[parentTypeName] = type;
            }
            if (altTypeName && altTypeName !== type.name)
                manager.components[altTypeName] = type;

            if (type.prototype instanceof GeneratorBase) {
                if (existing) {
                    const existingConfig = manager.settings.ast.generators[parentTypeName] || {};
                    manager.settings.ast.generators[parentTypeName] = { ...existingConfig, ...newEntry };
                }
                else
                    manager.settings.ast.generators[type.name] = newEntry;
            }
            else if (type.prototype instanceof AstBuilder) {
                if (existing) {
                    const existingConfig = manager.settings.ast.builders[parentTypeName] || {};
                    manager.settings.ast.builders[parentTypeName] = { ...existingConfig, ...newEntry };
                }
                else
                    manager.settings.ast.builders[type.name] = newEntry;
            }
            else if (type.prototype instanceof ExtensionLoader) {
                if (existing) {
                    const existingConfig = manager.settings.loaders[parentTypeName] || {};
                    manager.settings.loaders[parentTypeName] = { ...existingConfig, ...newEntry };
                }
                else
                    manager.settings.loaders[type.name] = newEntry;
            }
        }
        return this;
    }

    /**
     * Allow the user to update the configuration
     * @param {function(Partial<KLF.IModuleManager>): Partial<KLF.IModuleManager>} callback The changes to apply to the config
     * @returns 
     */
    updateConfig(callback) {
        const newConfig = callback(manager.settings);
        if (typeof newConfig === 'object') {
            manager.applyConfigChange(newConfig);
        }
    }
}

const wrapper = new ModuleManagerSafeWrapper();

Object.seal(wrapper);

module.exports = {
    ModuleManager: manager,
    ModuleManagerWrapper: wrapper
};

