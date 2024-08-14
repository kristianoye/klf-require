'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * Base AST generator type
 * 
 * @version 1.0.0
 */
const
    RegExUtil = require('../../util/RegExUtil'),
    ConfigUtil = require('../../util/ConfigUtil'),
    path = require('path'),
    fs = require('fs');

/** @implements {KLF.IAstGenerator} */
class GeneratorBase {
    /**
     * Construct the provider
     * @param {Partial<KLF.IAstGenerator>} settings
     */
    constructor(settings) {
        if (typeof settings.condition === 'undefined')
            settings.condition = () => true;
        ConfigUtil.fill(this, {
            weight: GeneratorBase.calculateWeight(settings),
            ...settings,
        });
        this.tokenType = typeof settings.tokenType === 'number' && settings.tokenType in TokenType && settings.tokenType;
    }

    /**
     * Create a sorting weight based on the condition
     * @param {KLF.IAstGenerator} instance 
     * @returns 
     */
    static calculateWeight(instance) {
        const condition = instance.condition;
        if (typeof condition === 'string')
            return 100 + condition.length;
        else if (typeof condition === 'object' && condition instanceof RegExp) {
            return RegExUtil.calculateWeight(condition);
        }
        else if (typeof condition === 'function') {
            return 1;
        }
        else
            throw new Error(`AstTokenProvider '${instance.name}' does not have a valid test condition`);
    }

    /**
     * Return all known generator types
     * @param {Partial<KLF.IModuleManager>} config The configuration being built
     */
    static enumerateBuiltinTypes(config) {
        const files = fs.readdirSync(__dirname, { encoding: 'utf8', recursive: true })
            .filter(f => {
                if (__filename.endsWith(f))
                    return false;
                return f.search(/\.js$/i) > -1;
            }).map(f => path.join(__dirname, f));

        config.ast.generators = {};

        for (const filename of files) {
            const generator = require(filename);
            if (generator.prototype instanceof this) {
                config.ast.generators[generator.name] = {
                    name: generator.name,
                    type: generator,
                    config: typeof generator.getDefaultConfig === 'function' && generator.getDefaultConfig(config)
                };
            }
        }
    }

    static getDefaultConfig() {
        return { enabled: true };
    }

    /**
     * Attempt to create a token given the information we have
     * @param {KLF.IAstBuilder} ast The AST builder
     * @param {KLF.ITokenizerContext} context The current context
     * @param {string} raw The raw text read from source
     */
    getToken(ast, context, raw) {
        if (this.tokenType) {
            const { condition } = this;
            if (typeof condition === 'string') {
                return ast.startToken({
                    type: this.tokenType,
                    raw
                })
            }
            else if (typeof condition === 'object' && condition instanceof RegExp) {
                return ast.startToken({
                    type: this.tokenType,
                    ...raw
                });
            }
        }
        throw new Error('not implemented');
    }

    /**
     * Test to see if this provider can construct a token
     * @param {KLF.AstGenerator<any>} parent The generator creating AST
     * @param {KLF.ITokenizerContext} context The current context
     * @returns {boolean}
     */
    test(parent, context) {
        if (typeof this.condition === 'string' && this.condition.length > 0) {
            const slice = parent.remainder.slice(0, this.condition.length);
            return slice === this.condition && slice;
        }
        else if (typeof this.condition === 'object' && this.condition instanceof RegExp) {
            if (this.hasCapture === true) {
                const match = this.condition.exec(parent.remainder);
                return match !== null && (match.groups || true);
            }
            else
                return this.condition.test(parent.remainder);
        }
        else if (typeof this.condition === 'function') {
            return this.condition.call(this, this, this.context);
        }
    }
}

module.exports = GeneratorBase;
