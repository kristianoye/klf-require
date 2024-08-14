'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
const Generator = require('./GeneratorBase');

class FunctionGenerator extends Generator {
    /** @param {KLF.IAstGenerator} */
    constructor(settings) { super({ ...settings, condition: 'function' }); }

    /** @type {KLF.GetTokenCallback} */
    getToken(ast, context) {
        return {};
    }
}

module.exports = FunctionGenerator;
