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
const { ModuleManagerWrapper } = require('./ModuleManager');

/**
 * Configure the preprocessor for a list of extensions.
 * @param {KLF.ExternalFunctionNames | Partial<KLF.IModuleManager>} configData The list of extensions to configure
 * @param {{ manager: Partial<KLF.IModuleManager>, loader: Partial<KLF.IExtensionLoader>}} data
 */
module.exports = ModuleManagerWrapper;