/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
'use strict';

/// <reference path="index.d.ts" />
const ConfigUtil = require('./util/ConfigUtil');
const { ModuleManager, ModuleManagerWrapper } = require('./ModuleManager');

/**
 * Configure the preprocessor for a list of extensions.
 * @param {KLF.ExternalFunctionNames | Partial<KLF.IModuleManager>} configData The list of extensions to configure
 * @param {{ manager: Partial<KLF.IModuleManager>, loader: Partial<KLF.IExtensionLoader>}} data
 */
module.exports = function (configData = {}, { manager, loader } = {}) {
    if (typeof configData === 'string') {
        if (configData.charAt(0) === '_')
            throw new Error(`Permission to method '${configData}' denied; Underscore methods are protected`);
        else if (configData === 'init') {
            if (typeof manager !== 'object')
                throw new Error(`Missing parameter for '${configData}'; Requires KLF.IModuleManager object`);
            activeConfig = new ModuleManager(manager);
        }
    }
    else if (typeof configData === 'object') {
        ModuleManager.applyConfigChange(configData);
        return ModuleManagerWrapper;
    }
}


