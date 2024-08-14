/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
'use strict';

class ObjectUtil {
    static isClass(type) {
        return typeof type === 'function' && type.toString().startsWith('class ');
    }

    /**
     * Get a parent class name
     * @param {object} type The object instance or class to get parent name of
     * @returns 
     */
    static parentClassName(type) {
        if (typeof type === 'object') {
            return type.constructor.name;
        }
        else if (ObjectUtil.isClass(type))
            return Object.getPrototypeOf(type).name || 'Object';
    }
}

module.exports = ObjectUtil;
