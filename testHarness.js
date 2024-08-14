try {
    /** @type {KLF.IModuleManagerWrapper} */
    const wrapper = require('./index.js');

    wrapper.updateConfig((config, { LogDetailLevel }) => {
        config.enabled = true;
        config.debug = LogDetailLevel.Verbose;
    });

    wrapper.extendTypes(({ GeneratorBase }) => {
        return class ClassGenerator extends GeneratorBase {
            static getDefaultConfig() {
                return { enabled: true };
            }
        }
    });
}
catch (err) {
    console.log(err + '\n' + err.stack);
    return 0;
}