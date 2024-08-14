try {
    /** @type {KLF.IModuleManagerWrapper} */
    const wrapper = require('./index.js')({ enabled: true });

    wrapper.extendTypes(({ ClassGenerator }) => {
        return class NewClassGenerator extends ClassGenerator {
            static getDefaultConfig() {
                return { enabled: true };
            }
        }
    });

    wrapper.updateConfig(config => {
        config.enabled = true;
    });
}
catch (err) {
    console.log(err + '\n' + err.stack);
    return 0;
}