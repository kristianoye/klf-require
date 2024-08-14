'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
const Generator = require('./GeneratorBase');

class SemicolonGenerator extends Generator {
    /** @param {KLF.IAstGenerator} */
    constructor(settings) {
        super({ ...settings, condition: ';', tokenType: TokenType.Semicolon });
    }
}

module.exports = SemicolonGenerator;
