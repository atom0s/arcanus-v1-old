/**
 * arcanus - Copyright (c) 2015-2016 atom0s [atom0s@live.com]
 *
 * This work is licensed under the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by-nc-nd/4.0/ or send a letter to
 * Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
 *
 * By using arcanus, you agree to the above license and its terms.
 *
 *      Attribution - You must give appropriate credit, provide a link to the license and indicate if changes were
 *                    made. You must do so in any reasonable manner, but not in any way that suggests the licensor
 *                    endorses you or your use.
 *
 *   Non-Commercial - You may not use the material (arcanus) for commercial purposes.
 *
 *   No-Derivatives - If you remix, transform, or build upon the material (arcanus), you may not distribute the
 *                    modified material. You are, however, allowed to submit the modified works back to the original
 *                    arcanus project in attempt to have it added to the original project.
 *
 * You may not apply legal terms or technological measures that legally restrict others
 * from doing anything the license permits.
 *
 * You may contact me, atom0s, at atom0s@live.com for more information or if you are seeking commercial use.
 *
 * No warranties are given.
 */

"use strict";

var fs = require('fs');
var path = require('path');
var utils = require('./utils.js');

module.exports = function ConfigurationModule(arcanus) {
    /**
     * The root path to the arcanus folder. (Where arcanus.js is located.)
     *
     * @readonly
     * @static
     * @type {string}
     */
    Configuration.DOCUMENT_ROOT = __dirname.substr(0, __dirname.indexOf(path.sep + 'include'));

    /**
     * The default configuration file name.
     *
     * @static
     * @readonly
     * @type {string}
     */
    Configuration.CONFIG_FILE_NAME = 'config.js';

    /**
     * The default paths to look for an arcanus configuration file.
     *
     * @type {Array}
     */
    Configuration.CONFIG_FILE_PATHS = [
        path.join(Configuration.DOCUMENT_ROOT, 'config', Configuration.CONFIG_FILE_NAME),
        path.join(Configuration.DOCUMENT_ROOT, Configuration.CONFIG_FILE_NAME)
    ];

    /**
     * The default arcanus configurations to use if no configuration file is found.
     *
     * @private
     * @readonly
     * @static
     * @type {object}
     */
    Configuration.DEFAULT_CONFIG = {
        root_path: Configuration.DOCUMENT_ROOT,

        server: {
            host: '0.0.0.0',
            port: process.env.PORT || '80'
        },

        site: {
            name: 'arcanus',
            path: 'http://localhost/',
            meta: {
                description: 'A Node.js website framework that is extensible through plugins.',
                keywords: 'arcanus, node, nodejs, plugins, framework'
            },
            cookieSecret: 'DefaultArcanusCookieSecret'
        },

        plugins: {
            failOnLoad: true,
            enabled: [],

            __loadedPluginConfigurations: [],

            /**
             * Obtains a plugins specific configurations.
             *
             * @param {string} uid                  The unique id of the plugin.
             * @returns {object|null}               The plugins configurations.
             */
            get: function (uid) {
                return this.__loadedPluginConfigurations[uid] || null;
            }
        }
    };

    /**
     * Implements functions related to configuration file usage within arcanus.
     *
     * @constructor
     */
    function Configuration() {
        var self = this;

        // Load the configuration file..
        this.config = Configuration.loadArcanusConfig();

        // Check if no configuration was found..
        if (this.config === null) {
            arcanus.log.warn('Configuration: No configuration file was found for arcanus! Using default configurations.');
        }

        // Merge the configurations with the defaults..
        this.config = arcanus.utils.deepMerge(this.config, Configuration.DEFAULT_CONFIG);

        // Load additional plugin configurations and merge with the arcanus configuration file..
        //
        // Note:
        //      Configurations loaded from the /config/ folder are considered high-level configuration files.
        //      These extend the base config object rather then load into a plugin specific configuration block.
        //
        var files = null;
        try {
            files = fs.readdirSync(path.join(__dirname, '..', 'config/'));
        } catch (e) {
            arcanus.log.warn('Configuration: Failed to read /config/ folder. Using default configurations.');
            return;
        }

        files.forEach(function (f) {
            // Skip folders..
            if (fs.statSync(path.join(__dirname, '..', 'config/', f)).isDirectory())
                return;

            // Skip non-js files..
            var ext = path.extname(f);
            if (ext !== '.js')
                return;

            // Skip the default arcanus config file..
            if (f.toLowerCase() === Configuration.CONFIG_FILE_NAME)
                return;

            try {
                // Load and merge the configuration..
                var cfg = require(path.join(__dirname, '..', 'config/', f));
                self.config = arcanus.utils.deepMerge(self.config, cfg);
                arcanus.log.info('Configuration: Loaded extended configurations from: %s', f);
            } catch (e) {
                arcanus.log.error('Configuration: Failed to load a configuration file: %s', f);
            }
        });
    }

    /**
     * Attempts to load the arcanus configuration file.
     *
     * @private
     * @static
     * @returns {object|null}                       The loaded configuration file, null otherwise.
     */
    Configuration.loadArcanusConfig = function () {
        var config = null;
        var f = Configuration.CONFIG_FILE_PATHS;

        for (var x = 0; x < f.length; x++) {
            if (fs.existsSync(f[x])) {
                try {
                    config = require(f[x]);
                    arcanus.log.info('Configuration: Loaded configuration file at: %s', f[x]);
                    break;
                } catch (e) {
                    arcanus.log.error('Configuration: Failed to use a configuration file! [%s] %s', f[x], e.stack);
                }
            }
        }

        return config;
    };

    /**
     * Returns the underlying config object.
     *
     * @returns {object}                            The loaded configuration object.
     */
    Configuration.prototype.get = function () {
        return this.config;
    };

    // Return the configuration module..
    return Configuration;
};