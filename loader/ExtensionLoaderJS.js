'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
const ExtensionLoader = require('./ExtensionLoader');
const AstGeneratorJS = require('../ast/AstGeneratorJS');

/**
 * @typedef {KLF.IExtensionLoader<AstGeneratorJS>} IExtensionLoaderJS
 */

/**
 * Default loader for JS files
 * @implements {IExtensionLoaderJS}
 */
class ExtensionLoaderJS extends ExtensionLoader {
    /**
     * Construct a loader for Javascript files
     * @param {ModuleManager} manager The ModuleManager singleton
     * @param {IExtensionLoaderJS} settings The settings used to configure this loader
     */
    constructor(manager, settings) {
        super(manager, settings);
    }

    /**
     * Define a token provider
     * @param {string} name The unique provider name
     * @param {KLF.IAstGenerator} provider The provider
     */
    addTokenProvider(name, provider) {
        this.tokenProviders[name] = provider;
        return this;
    }

    /**
     *
     * @param {Partial<KLF.IAstBuilder<KLF.IToken>>} options
     * @returns {KLF.IAstBuilder<KLF.IToken>}
     */
    createTreeBuilder(options) {
        return new AstGeneratorJS({ ...options, loader: this });
    }

    /**
     * Get the default config
     * @param {Partial<KLF.IModuleManager>} config Configuration being created
     * @returns 
     */
    static getDefaultConfig(config) {
        const componentConfig = {
            ast: {
                builder: AstGeneratorJS,
                generators: config.ast.generators
            },
            enabled: true,
            exclude: [],
            extensions: [".js"],
            include: [],
            macros: {
                __callsite: {
                    enabled: true
                },
                __class: {
                    enabled: true
                },
                __date: {
                    enabled: true
                },
                __function: {
                    enabled: true
                },
                __location: {
                    enabled: false
                },
                __member: {
                    enabled: true,
                },
                __newid: {
                    enabled: false
                }
            }
        }

        return componentConfig;
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

module.exports = ExtensionLoaderJS;
