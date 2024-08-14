/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
'use strict';

/**
 * Provides some path-related utilities
 * @since 1.0.0
 */
class RegExUtil {
    /**
     * Parse a regex ... needs work
     * @param {string | RegExp} regex The expression to parse
     * @returns {[ { group: string, reclass: string, capture: string, length: number } ]}
     */
    static parseRegex(regex) {
        if (typeof regex === 'object' && regex instanceof RegExp) {
            regex = regex.toString();
        }
        if (typeof regex === 'string') {
            const groupPattern = /(?<reclass>\[.*?\])|(?<capture>\(.*?\))/g;
            const matches = [];
            let match;

            while ((match = groupPattern.exec(regex)) !== null) {
                const { reclass, capture } = match.groups,
                    result = {
                        group: reclass || capture,
                        reclass,
                        capture,
                        length: ((reclass || '') + (capture + '')).length
                    };

                if (capture) {
                    result.captureDef = parseRegex(capture.slice(1, capture.length - 1)) || capture;
                }
                matches.push(result);
            }

            return matches;
        }
        else
            throw new Error(`Bad argument 1 to RegexHelper.parseRegex(); Expected string or RegExp, but got ${typeof regex}`);
    }

    /**
     * Assigns a weight score based on how lazy or greedy the expression is ... also needs work
     * @param {string | RegExp} regex The regex to "weigh"
     * @returns The weight score
     */
    static weighRegex(regex) {
        if (typeof regex === 'object' && regex instanceof RegExp) {
            regex = regex.toString();
        }
        if (typeof regex === 'string') {
            const matches = RegExUtil.parseRegex(regex);
            let weight = -1;
            for (const data of matches) {
                const { reclass, capture } = data;
                if (reclass) {
                    // match zero or more
                    if (reclass.endsWith('*'))
                        weight -= 100;
                    // match one or more
                    else if (reclass.endsWith('+'))
                        weight -= 50;
                    // match single character
                    else if (reclass.endsWith(']'))
                        weight += 50;
                    else if (reclass.endsWith('}')) {
                        const s = reclass.lastIndexOf('{'),
                            e = reclass.lastIndexOf('}'),
                            r = reclass.slice(s + 1, e),
                            rp = r.split(',').map(s => s.trim()).filter(s => s.length > 0).unshift();
                        weight -= (rp ** rp);
                    }
                }
                else if (capture) {
                    instance.hasCapture = true;
                }
            }
            return weight;
        }
        else
            throw new Error(`Bad argument 1 to RegexHelper.parseRegex(); Expected string or RegExp, but got ${typeof regex}`);
    }
}

module.exports = RegExUtil;
