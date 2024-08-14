(function () {
    'use strict';

    /**
     * Assign numeric values to each key in a dictionary;
     * Allow for lookup by name or index
     * @template T
     * @param {string} typeName The name of the enum type
     * @param {T} o The object to enumerate
     * @param {KLF.EnumType} enumType The type of enum
     * @returns {T & { parse: function(string | number): T, toString: function(string | number): string, tryParse: function(string | number, defaultValue: T, getNVP: false ): T }}
     */
    function createEnum(typeName, o, enumType = 'number') {
        /** @type {KLF.EnumType[]} */
        const validTypes = ['bitflag', 'number', 'string'];
        if (validTypes.indexOf(enumType) === -1)
            throw new Error(`${__filename}: '${enumType}' is not a valid enum type for ${typeName}`);
        var result = {
            ...o,
            enumType,
            keyNames: Object.keys(o),
            typeName,
            typeNamePrefix: typeName.toLowerCase() + '.',
            /**
             * Attempt to convert a number or string into one of our specified values
             * @param {string | number} spec The supplied value
             * @param {T?} defaultValue default value
             * @returns {KLF.ScriptENUM}
             */
            tryParse: function (spec, defaultValue = undefined, getNVP = false, withTypeName = true) {
                if (getNVP) {
                    const name = this.tryParse(spec, defaultValue, false, withTypeName),
                        value = typeof name == 'string' && this[name] || undefined;
                    if (typeof name !== 'undefined')
                        return { name, value };
                    else
                        return undefined;
                }
                else if (typeof spec === 'string') {
                    /** @type {(string | number)[]} */
                    const parts = spec.split('|')
                        .map(s => {
                            s = s.trim().toLowerCase();
                            if (s.startsWith(this.typeNamePrefix))
                                s = s.slice(this.typeNamePrefix.length);
                            return this[s];
                        });

                    if (parts.length === 0)
                        return defaultValue;
                    else if (this.enumType === 'bitflag') {
                        if (this.enumType === 'bitflag') {
                            let result = 0;
                            for (const val of parts) {
                                if (typeof val === 'number') {
                                    result |= val;
                                }
                            }
                            return result;
                        }
                    }
                    else if (this.enumType === 'number') {
                        if (parts.length === 1)
                            return parts[0];
                        else
                            return parts;
                    }
                    else if (this.enumType === 'string') {
                        if (parts.length === 1)
                            return parts[0];
                        else
                            return parts;
                    }
                }
                else if (typeof spec === 'number') {
                    if (this.enumType === 'bitflag') {
                        const result = [], values = {};
                        for (const [key, val] of Object.entries(this)) {
                            const numericKey = parseInt(val);
                            if (!isNaN(numericKey)) {
                                //  Do not display every possible name mapped
                                if (numericKey in values) continue;
                                if ((numericKey & spec) > 0) {
                                    result.push(`${typeName}.${key}`);
                                    values[numericKey] = val;
                                }
                            }
                        }
                        if (result.length === 0)
                            return defaultValue;
                        return result.join(' | ');
                    }
                    else if (this.enumType === 'number') {
                        const result = this[spec];
                        if (typeof result === 'undefined')
                            return defaultValue;
                        return withTypeName ? `${typeName}.${result} ` : result;
                    }
                    else if (this.enumType === 'string') {
                        const result = this[spec];
                        if (typeof result === 'undefined')
                            return defaultValue;
                        return result;
                    }
                }
                return undefined;
            },
            /**
             * Attempt to convert a number or string into one of our specified values
             * Throws an exception if the type does not contain a matching key
             * @param {string | number} spec The supplied value
             * @returns {{KLF.ScriptENUM}
             */
            parse: function (spec, getNVP = false) {
                const result = this.tryParse(spec, undefined, getNVP);
                if (typeof result !== 'undefined')
                    return result;
                throw new Error(`parse() failed to determine value for ${spec}`);
            },
            toString: function (spec) {
                const { name } = this.parse(spec, true);
                return `${this.typeName}.${name}`;
            }
        };
        let c = enumType === 'bitflag' ? 1 : 0;
        for (const [key, val] of Object.entries(o)) {
            //  Did the type define specific, numeric values?
            if (enumType === 'number') {
                let actualVal = typeof val === 'number' ? val : c++;

                // Reverse lookup
                result[actualVal] = key;

                // Forward lookups
                result[key] = actualVal;
                result[key.toLowerCase()] = actualVal;
            }
            else if (enumType === 'bitflag') {
                if (typeof val !== 'number') {
                    if (c < 0) {
                        throw new Error(`Too many flags defined in type ${typeName} `);
                    }
                    result[c] = key;
                    // Forward lookups
                    result[key] = c;
                    result[key.toLowerCase()] = c;
                    c <<= 1;
                }
                else {
                    // Reverse lookup
                    result[flagValue] = key;
                    // Forward lookups
                    result[key] = c;
                    result[key.toLowerCase()] = c;
                }
            }
            else if (enumType === 'string') {
                // Reverse lookup
                result[val] = key;
                // Forward lookups
                result[key] = val;
                result[key.toLowerCase()] = val;
            }
        }
        return Object.freeze(result), Object.seal(result);
    }

    module.exports = createEnum;
})();