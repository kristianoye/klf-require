'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
const Generator = require('./GeneratorBase');

class NumberGenerator extends Generator {
    /** @param {KLF.IAstGenerator} */
    constructor(settings) {
        super(settings);
        //  Could I combine them into one, big, gross regex... sure?
        this.testers = [
            /^(?<decimal>[1-9](?:_?[0-9]+\.?)+(?:_?[0-9]+\.?)*n?)/,
            /^(?<hex>0[xX][a-fA-F0-9](?:_?[a-fA-F0-9]+)+n?)/,
            /^(?<exp>[0-9]+[eE]-[0-9+]n?)/,
            /^(?<binary>0[bB][01]?(_?[01]+)*n?)/, // BUG: Allows multiple underscores
            /^(?<octal>0[oO][0-7]+n*)/
        ]
    }

    /** @type {KLF.TestTokenCallback} */
    test(ast, context) {
        for (const test of this.testers) {
            const match = test.exec(ast.remainder);
            if (match === null) return false;
            const { decimal, hex, exp, binary, octal } = match.groups;
            if (decimal)
                return { raw: decimal, format: 'decimal' };
            else if (hex) {
                return { raw: hex, format: 'hexidecimal' };
            }
            else if (exp) {
                if (binary.indexOf('__') > -1)
                    return false;
                return { raw: binary, format: 'exponential' };
            }
            else if (octal) {
                return { raw: octal, format: 'octal' };
            }
        }
    }

    /** @type {KLF.GetTokenCallback} */
    getToken(ast, context, { raw, format }) {
        const token = ast.startToken({ type: TokenType.Number, raw, format, isBigInt: raw.endsWith('n') });
        return { token };
    }
}

module.exports = NumberGenerator;
