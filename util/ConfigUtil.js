module.exports = (function () {
    'use strict';
    /**
     * Provides some configuration utilities
     * @since 1.0.0
     */
    class ConfigUtil {
        /**
         * @template T
         * @param {T} instance The instance to fill
         * @param {Partial<T>} config The settings to put into instance
         */
        static fill(instance, config) {
            for (const [key, val] of Object.entries(config)) {
                instance[key] = val;
            }
        }

        /**
         *
         * @param {Object.<string,any>} source The starting point
         * @param {...Object.<string,any>} updates Object(s) to merge into the original source
         * @since 1.0.0
         */
        static mergeConfigs(source, ...updates) {
            const isClass = (v) => { return typeof v === 'function' && v.toString().startsWith('class') };

            if (typeof source !== 'object')
                throw new Error(`Bad argument 1 to mergeObjects(); Expected object but got ${typeof source} `);
            var result = { ...source };
            for (const update of updates) {
                for (const [key, val] of Object.entries(update)) {
                    if (Array.isArray(val)) {
                        result[key] = val.slice(0);
                    }
                    else if (typeof val === 'object') {
                        if (false === key in result)
                            result[key] = {};
                        else if (isClass(result[key])) {
                            if (typeof result[key].defaultConfig === 'object')
                                result[key].defaultConfig = ConfigUtil.mergeConfigs(result[key].defaultConfig, val);
                            continue;
                        }
                        result[key] = ConfigUtil.mergeConfigs(result[key] || {}, val);
                    }
                    else {
                        result[key] = val;
                    }
                }
            }
            return result;
        }
    }
    return ConfigUtil;
})();
