/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
'use strict';
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

/**
 * @implements {KLF.IExtensionLoader<KLF.IAstBuilder<KLF.IToken>, KLF.IToken>}
 */
class ExtensionLoader extends EventEmitter {
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

        /** @type {Object.<string,KLF.NativeRequireLoader>} */
        this.fallbackLoaders = {};

        /** @type {Object.<string,KLF.IAstGenerator>} */
        this.tokenProviders = settings.tokenProviders;

        /** @type {KLF.IAstGenerator[]} */
        this.tokenProvidersSorted = [];
    }

    /**
     *
     * @param {string} extension The extension we are defining a fallback for
     * @param {KLF.NativeRequireLoader} callback The callback we should use if we fail
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
     * @param {Partial<KLF.IAstBuilder<KLF.IToken>>} options
     * @returns {KLF.IAstBuilder<any>}
     */
    createTreeBuilder(options) {
        if (!this.astGenerator)
            throw new Error(`ExtensionLoader ${this.name} did not define an AstGenerator`);
        const
            generator = new this.astGenerator({ ...options, loader: this });
        return generator;
    }

    /**
     * Get all known loadertypes
     */
    static enumerateBuiltinTypes(config) {
        const files = fs.readdirSync(__dirname, { encoding: 'utf8', recursive: true })
            .filter(f => {
                //  Do not load ourself!
                if (__filename.endsWith(f))
                    return false;
                return f.slice(f.lastIndexOf(path.sep)).search(/.+ExtensionLoader[^\.]+/i);
            })
            .map(f => path.join(__dirname, f));
        /** @type {KLF.ExtensionLoaderCollection} */

        let loaders = config.loaders = {};

        for (const filename of files) {
            try {
                const loader = require(filename);

                if (loader.prototype instanceof this)
                    config.loaders[loader.name] = {
                        name: loader.name,
                        type: loader,
                        config: typeof loader.getDefaultConfig === 'function' && loader.getDefaultConfig(config)
                    };
            }
            catch (er) {
                console.log(`Failed to load ${filename}: ${er}`);
            }
        }
        return loaders;
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

module.exports = ExtensionLoader;
