/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * @version 1.0.0
 */
'use strict';

const fs = require('fs'),
    path = require('path'),
    projectRoot = require.main.filename;

/**
* Provides some path-related utilities
* @since 1.0.0
*/
class PathUtil {
    /**
     * Attempt to find node_modules directories in our path structure
     * @param {string} startIn The directory in which we start our search
     * @returns {string[]}
     * @since 1.0.0
     */
    static locateNodeModulesDirectory(startIn = __dirname) {
        const pathParts = startIn.split(path.sep).filter(s => s.length > 0);
        const result = [];

        while (pathParts.length > 0) {
            const thisPath = pathParts.join(path.sep),
                nodeInPath = path.join(thisPath, 'node_modules');

            if (!thisPath.startsWith(projectRoot))
                break;

            if (thisPath.endsWith('node_modules'))
                result.push(thisPath);
            else {
                try {
                    fs.statfsSync(nodeInPath);
                    result.push(nodeInPath);
                }
                catch { }
            }
            pathParts.pop();
        }
        return result;
    }
}

module.exports = PathUtil;


