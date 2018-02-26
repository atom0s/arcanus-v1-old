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
var _ = require('lodash');
var async = require('async');
var bower = require('bower');
var express = require('express');
var npmInstall = require('spawn-npm-install');
var semver = require('semver');

/**
 * Plugin Service
 *
 * Exposes functions for interacting with plugins.
 *
 * @param {object} arcanus                          The arcanus application instance.
 */
module.exports = function PluginServiceModule(arcanus) {
    /**
     * The directory where plugins are installed to.
     *
     * @static
     * @type {string}
     */
    var PLUGIN_DIRECTORY = path.join(arcanus.config.root_path, 'plugins');

    /**
     * The main plugin file required for a plugin to be loaded.
     *
     * @static
     * @type {string}
     */
    var PLUGIN_ROOT_FILE = 'plugin.json';

    /**
     * The public directory name where a plugin shall store its public content.
     *
     * @static
     * @type {string}
     */
    var PLUGIN_PUBLIC_DIRECTORY = 'public';

    /**
     * Enumeration of dependency types that can be installed via a plugin.
     * @type {Object}
     */
    var DependencyType = Object.freeze({ npm: 0, bower: 1 });

    /**
     * Implements the plugin service.
     *
     * @constructor
     */
    function PluginService() {
        // Initialize the base service class..
        arcanus.BaseService.call(this);
    }

    // Inherit from the base service class (required!)..
    PluginService.prototype = Object.create(arcanus.BaseService.prototype);
    PluginService.constructor = arcanus.BaseService;

    /**
     * Returns the alias of the current service. (Must be overridden!)
     *
     * @returns {string}                            The alias of the current service.
     */
    PluginService.prototype.getAlias = function () {
        return 'pluginservice';
    };

    /**
     * Initializes the current service. (Must be overridden!)
     *
     * @param {function} done                       The callback to invoke when finished.
     */
    PluginService.prototype.Initialize = function (done) {
        this.LOADED_PLUGINS = {};
        done(null, true);
    };

    /** **/
    /** **/
    /** **/

    /**
     * Obtains the favorite icon to display on the website.
     *
     * Plugins can override the favorite icon in their settings. This will use the last loaded plugin whom
     * has overridden the favorite icon. (Last Loaded, First Served approach.)
     *
     * If the icon is not overridden, the default arcanus icon will be used.
     *
     * @param {function} done                       Callback function to invoke when completed.
     */
    PluginService.prototype.getFavIcon = function (done) {
        var icon = './public/img/favicon.ico';
        var self = this;

        Object.keys(self.LOADED_PLUGINS).forEach(function (k) {
            var plugin = self.LOADED_PLUGINS[k];
            if (plugin.json.favicon && arcanus.utils.isNonEmptyString(plugin.json.favicon)) {
                icon = path.join(PLUGIN_DIRECTORY, plugin.uid, PLUGIN_PUBLIC_DIRECTORY, plugin.json.favicon);
            }
        });

        // Return the icon to the callback..
        done(null, icon);
    };

    /**
     * Loads the enabled plugins within the arcanus configuration.
     *
     * @param {function} done                       Callback function to invoke when completed.
     */
    PluginService.prototype.loadPlugins = function (done) {
        var self = this;

        // Ensure the enabled plugins configuration exists..
        if (!arcanus.config.plugins || !arcanus.config.plugins.enabled || !arcanus.utils.isArray(arcanus.config.plugins.enabled))
            return done(null, true);

        // Obtain the list of plugins to load..
        var plugins = arcanus.config.plugins.enabled || [];
        if (plugins.length === 0)
            return done(null, true);

        // Build the plugin loading tasks..
        var tasks = [];
        plugins.forEach(function (dir) {
            tasks.push(function (callback) {
                self.loadPlugin(dir, function (err, result) {
                    return arcanus.config.plugins.failOnLoad
                        ? callback(err)
                        : callback();
                });
            });
        });

        // Process the plugin load tasks..
        async.series(tasks, function (err) {
            // Kill the process if configured to error on load..
            if (err && arcanus.config.plugins.failOnLoad) {
                arcanus.log.error(err.message);
                arcanus.log.error(err.stack);
                process.exit(1);
            }

            return done();
        });
    };

    /**
     * Validates a plugins dependencies by ensuring they are installed properly and up to date.
     *
     * @param {number} type                         The type of dependencies being validated. (node_modules or bower_components)
     * @param {string} dir                          The directory of the plugin being processed.
     * @param {object} deps                         The deps block of dependencies to process.
     * @param {function} done                       Callback function to invoke when completed.
     */
    PluginService.validateDependencies = function (type, dir, deps, done) {
        var isValid = true;
        var tasks = [];

        // Convert the type based on the given value..
        switch (type) {
            case DependencyType.npm:
                type = 'node_modules';
                break;
            case DependencyType.bower:
                type = 'bower_components';
                break;
            default:
                throw new Error('Invalid dependency type give.');
        }

        // Build the tasks to validate each dependency..
        Object.keys(deps).forEach(function (k) {
            tasks.push(function (callback) {
                // Build the path to the package.json file..
                var packagePath = path.join(PLUGIN_DIRECTORY, dir, type, k, 'package.json');

                // Ensure the file exists then process it..
                fs.exists(packagePath, function (exists) {
                    if (!exists) {
                        isValid = false;
                        return callback(null, false);
                    }

                    // Validate that semver is satisfied with the installed package version..
                    var packageJson = require(packagePath);
                    if (!semver.satisfies(packageJson.version, deps[k]))
                        isValid = false;

                    return callback();
                });
            });
        });

        // Run the tasks in parallel to validate the dependencies..
        async.parallel(tasks, function (err, results) {
            return done(err, isValid);
        });
    };

    /**
     * Processes a plugins npm dependencies.
     *
     * @private
     * @static
     * @param {string} dir                          The directory of the plugin being processed.
     * @param {object} deps                         The deps block of dependencies to process.
     * @param {function} done                       Callback function to invoke when completed.
     */
    PluginService.processNpmDependencies = function (dir, deps, done) {
        var pluginPath = path.join(PLUGIN_DIRECTORY, dir);

        // Build a list of modules to install..
        var modules = [];
        Object.keys(deps).forEach(function (k) {
            modules.push(k + '@' + deps[k]);
        });

        // Install the dependencies..
        npmInstall(modules, { 'prefix': pluginPath }, function (err) {
            if (err)
                return done(new Error('Failed to install dependencies (npm).'));

            arcanus.log.info('PluginService: Installed dependencies (npm) for plugin: ' + dir);
            return done(err);
        });
    };

    /**
     * Processes a plugins bower dependencies.
     *
     * @private
     * @static
     * @param {string} dir                          The directory of the plugin being processed.
     * @param {object} deps                         The deps block of dependencies to process.
     * @param {function} done                       Callback function to invoke when completed.
     */
    PluginService.processBowerDependencies = function (dir, deps, done) {
        var pluginPath = path.join(PLUGIN_DIRECTORY, dir);

        // Build a list of modules to install..
        var modules = [];
        Object.keys(deps).forEach(function (k) {
            modules.push(k + '#' + deps[k]);
        });

        bower.commands.install(modules, { save: false }, { cwd: pluginPath, interactive: false })
            .on('end', function (installed) {
                arcanus.log.info('PluginService: Installed dependencies (bower) for plugin: ' + dir);
                return done();
            })
            .on('error', function (err) {
                return done(new Error('Failed to install dependencies (bower).'));
            });
    };

    /**
     * Loads a specific function by its folder name.
     *
     * @param {string}  dir                         The name of the directory to load the plugin from.
     * @param {function} done                       Callback function to invoke when completed.
     */
    PluginService.prototype.loadPlugin = function (dir, done) {
        var self = this;
        var pluginJson = null;
        var tasks = [];

        // Load the plugin.json file..
        tasks.push(function (callback) {
            fs.readFile(path.join(PLUGIN_DIRECTORY, dir, PLUGIN_ROOT_FILE), function (err, data) {
                if (err)
                    return callback(err);

                try {
                    pluginJson = JSON.parse(data);
                    return pluginJson && arcanus.utils.isObject(pluginJson) && pluginJson !== null
                        ? callback()
                        : callback(new Error('Failed to parse the plugin.json file.'));
                } catch (e) {
                    return callback(e);
                }
            });
        });

        // Validate the plugin.json file..
        tasks.push(function (callback) {
            PluginService.validatePluginJson(pluginJson, function (err, result) {
                if (err)
                    return callback(err);

                // Ensure uid is lower-case..
                pluginJson.uid = pluginJson.uid.toLowerCase();

                return result !== true
                    ? callback(new Error('Unknown error occurred validating the plugin.json file.'))
                    : callback();
            });
        });

        // Validate the plugin is unique..
        tasks.push(function (callback) {
            return arcanus.utils.isObject(self.LOADED_PLUGINS[pluginJson.uid])
                ? callback(new Error(`Cannot load two plugins with the same uid. '${pluginJson.uid}'`))
                : callback();
        });

        // Handle the plugin dependencies (npm)..
        // TODO: Check if root arcanus depends are enough before adding more..
        tasks.push(function (callback) {
            // Do nothing if there are no dependencies..
            if (!arcanus.utils.isObject(pluginJson.dependencies) || pluginJson.dependencies === {})
                return callback();

            // Validate the dependencies for this plugin..
            PluginService.validateDependencies(DependencyType.npm, dir, pluginJson.dependencies.npm, function (err, result) {
                if (err)
                    return callback(err);

                // Do nothing if dependencies are valid..
                if (result)
                    return callback();

                // Install the dependencies for this plugin..
                PluginService.processNpmDependencies(dir, pluginJson.dependencies.npm, function (err, result) {
                    return callback(err);
                });
            });
        });

        // Handle the plugin dependencies (bower)..
        // TODO: Check if root arcanus depends are enough before adding more..
        tasks.push(function (callback) {
            // Do nothing if there are no dependencies..
            if (!arcanus.utils.isObject(pluginJson.dependencies) || pluginJson.dependencies === {})
                return callback();

            // Validate the dependencies for this plugin..
            PluginService.validateDependencies(DependencyType.bower, dir, pluginJson.dependencies.bower, function (err, result) {
                if (err)
                    return callback(err);

                // Do nothing if dependencies are valid..
                if (result)
                    return callback();

                // Install the dependencies for this plugin..
                PluginService.processBowerDependencies(dir, pluginJson.dependencies.bower, function (err, result) {
                    return callback(err);
                });
            });
        });

        // Handle the plugin configurations..
        tasks.push(function (callback) {
            // Store the plugins configurations..
            arcanus.config.plugins.__loadedPluginConfigurations[pluginJson.uid] = pluginJson.config || {};
            return callback();
        });

        // Load the plugin entry point script..
        tasks.push(function (callback) {
            var entry = null;
            if (arcanus.utils.isNonEmptyString(pluginJson.entry)) {
                try {
                    entry = require(path.join(PLUGIN_DIRECTORY, pluginJson.uid, pluginJson.entry))(arcanus);
                } catch (e) {
                    return callback(new Error('Failed to load plugin; exception occurred while loading entry script.'));
                }
            }

            // Add this plugin to the loaded array..
            self.LOADED_PLUGINS[pluginJson.uid] = {
                uid: pluginJson.uid,
                json: pluginJson,
                entry: entry
            };

            return callback();
        });

        // Invoke the plugin entry point scripts Initialize function..
        tasks.push(function (callback) {
            // Obtain the loaded plugin instance..
            var plugin = self.LOADED_PLUGINS[pluginJson.uid];
            if (!plugin)
                return callback(new Error('Failed to obtain loaded plugin for entry point initialization.'));

            // Do nothing if this plugin has no entry point script..
            if (plugin.entry === null)
                return callback();

            // Ensure the plugin entry script has an Initialize call..
            if (!arcanus.utils.isFunction(plugin.entry.Initialize))
                return callback(new Error('Entry point script missing required Initialize call.'));

            try {
                plugin.entry.Initialize(function (err, result) {
                    if (err)
                        return callback(err);

                    return result !== true
                        ? callback(new Error('Plugins entry point Initialize function failed.'))
                        : callback();
                });
            } catch (e) {
                return callback(e);
            }
        });

        // Register the plugin paths..
        tasks.push(function (callback) {
            // Add this plugins view path to the arcanus views..
            var views = arcanus.app.get('views');
            views.unshift(path.join(PLUGIN_DIRECTORY, pluginJson.uid, 'views'));
            arcanus.app.set('views', views);

            // Register the middleware paths for this plugin..
            var pluginMiddlewareName = 'plugin_' + pluginJson.uid + '_middleware';
            arcanus.app.use('/public', arcanus.utils.namedFunction(arcanus.utils.toSafePluginName(pluginMiddlewareName), require('less-middleware')(path.join(PLUGIN_DIRECTORY, pluginJson.uid, 'public'))));
            arcanus.app.use('/public', arcanus.utils.namedFunction(arcanus.utils.toSafePluginName(pluginMiddlewareName), express.static(path.join(PLUGIN_DIRECTORY, pluginJson.uid, 'public'))));
            arcanus.app.use('/public', arcanus.utils.namedFunction(arcanus.utils.toSafePluginName(pluginMiddlewareName), express.static(path.join(PLUGIN_DIRECTORY, pluginJson.uid, 'bower_components'))));

            return callback();
        });

        // Run the tasks to load this plugin..
        async.series(tasks, function (err) {
            if (err) {
                // If a plugin was partially loaded, delete it..
                if (err && pluginJson && pluginJson.uid) {
                    delete self.LOADED_PLUGINS[pluginJson.uid];
                    delete arcanus.config.plugins.__loadedPluginConfigurations[pluginJson.uid];
                }

                // Log the error that caused the plugin to fail to load..
                arcanus.log.error(`PluginService: Failed to load plugin: '${dir}', reason:`);
                arcanus.log.error(`\t${err.message}`);
                if (err.validationErrors)
                    err.validationErrors.forEach(function (e) {
                        arcanus.log.error(`\t\t${e}`);
                    });

                return done(new Error('Failed to load plugin. Please check the logs for more information.'));
            }

            arcanus.log.info('PluginService: Loaded plugin: %s [v%s by %s (%s)]', pluginJson.uid, pluginJson.version, pluginJson.author.name, pluginJson.author.website);
            return done(null, true);
        });
    };

    /**
     * Unloads a plugin by its uid.
     *
     * @param {string} uid                          The unique plugin identifier.
     * @param {function} done                       Callback function to invoke when completed.
     */
    PluginService.prototype.unloadPlugin = function (uid, done) {
        // Validate the incoming uid..
        if (!arcanus.utils.isNonEmptyString(uid) || !this.LOADED_PLUGINS[uid])
            return done(new Error('Invalid plugin uid, could not find plugin.'), false);

        // Delete the loaded plugin..
        delete this.LOADED_PLUGINS[uid];
        delete arcanus.config.plugins.__loadedPluginConfigurations[uid];

        // Remove the plugins view path..
        var views = arcanus.app.get('views');
        for (var x = 0; x < views.length; ++x) {
            if (views[x] == path.join(PLUGIN_DIRECTORY, uid.toLowerCase(), 'views')) {
                views.splice(x, 1);
                break;
            }
        }
        arcanus.app.set('views', views);

        // Remove the plugins middleware paths..
        var pluginMiddlewareName = 'plugin_' + uid.toLowerCase() + '_middleware';
        _.remove(arcanus.app._router.stack, function (s) { return s.name == arcanus.utils.toSafePluginName(pluginMiddlewareName); });

        // Remove the plugins router paths..
        var pluginRouterName = 'plugin_' + uid.toLowerCase() + '_router';
        _.remove(arcanus.app._router.stack, function (s) { return s.name == arcanus.utils.toSafePluginName(pluginRouterName); });

        arcanus.log.info('PluginService: Unloaded plugin: %s', uid);
        return done(null, true);
    };

    /**
     * Validates a plugins plugin.json file contents.
     *
     * @param {object} json                         The plugins plugin.json file contents.
     * @param {function} done                       Callback function to invoke when completed.
     */
    PluginService.validatePluginJson = function (json, done) {
        // Ensure the incoming json is an object..
        if (!arcanus.utils.isObject(json))
            return done(new Error('Invalid plugin.json file! Not a valid object.'), false);

        var errors = [];
        var utils = arcanus.utils;

        // Validate the plugin uid..
        if (!utils.isNonEmptyString(json.uid) || !utils.isValidFileName(json.uid))
            errors.push('Invalid plugin uid. Uid should consist of letters, numbers, underscores or dashes only!');

        // Validate the plugin name..
        if (!utils.isNonEmptyString(json.name))
            errors.push('Invalid plugin name. Name should be a non-empty string.');

        // Validate the plugin description..
        if (!utils.isNonEmptyString(json.description))
            errors.push('Invalid plugin description. Description should be a non-empty string.');

        // Validate the plugin version..
        if (!utils.isValidVersion(json.version))
            errors.push('Invalid plugin version. Version should be a non-empty string following the 0.0.0 pattern.');

        // Validate the plugin author..
        if (json.author) {
            if (!utils.isNonEmptyString(json.author.name))
                errors.push('Invalid plugin author name. Author must be a non-empty string.');
            if (!utils.isNonEmptyString(json.author.email) || !utils.isValidEmail(json.author.email))
                errors.push('Invalid plugin author email. Author email must be a non-empty valid email address.');
            if (!utils.isNonEmptyString(json.author.website) || !utils.isValidUrl(json.author.website))
                errors.push('Invalid plugin author website. Author website must be a non-empty valid url.');
        } else {
            errors.push('Invalid plugin author. Author should be an object consisting of name, email and website string properties.');
        }

        // Validate the favicon if its set..
        if (json.favicon) {
            if (utils.isNonEmptyString(json.favicon)) {
                // Ensure the favicon exists..
                if (!fs.existsSync(path.join(PLUGIN_DIRECTORY, json.uid, PLUGIN_PUBLIC_DIRECTORY, json.favicon)))
                    errors.push('Invalid plugin favicon. The favicon value must point to a valid file within your plugins /public/ directory.');
            } else {
                errors.push('Invalid plugin favicon. If the favicon is present and set, it must be a non-empty string.');
            }
        }

        // Validate the plugins entry script..
        if (json.entry) {
            if (utils.isNonEmptyString(json.entry)) {
                if (!fs.existsSync(path.join(PLUGIN_DIRECTORY, json.uid, json.entry)))
                    errors.push('Invalid plugin entry. If the entry is present and set, it must point to a valid entry file.');
            } else {
                errors.push('Invalid plugin entry. If the entry is present and set, it must be a non-empty string.');
            }
        }

        // Validate the plugins dependencies if set..
        if (json.dependencies) {
            if (!utils.isObject(json.dependencies)) {
                errors.push('Invalid plugin dependencies. Dependencies should be an object.');
            } else {
                // Validate the plugins npm dependencies..
                if (json.dependencies.npm) {
                    if (!utils.isObject(json.dependencies.npm)) {
                        errors.push('Invalid plugin dependencies (npm). npm dependencies should be an object.');
                    } else {
                        for (var modName in json.dependencies.npm) {
                            if (!utils.isNonEmptyString(json.dependencies.npm[modName]))
                                errors.push('Invalid plugin dependency (npm). ' + modName + ' is invalid.');
                        }
                    }
                }

                // Validate the plugins bower dependencies..
                if (json.dependencies.bower) {
                    if (!utils.isObject(json.dependencies.bower)) {
                        errors.push('Invalid plugin dependencies (bower). bower dependencies should be an object.');
                    } else {
                        for (var modName in json.dependencies.bower) {
                            if (!utils.isNonEmptyString(json.dependencies.bower[modName]))
                                errors.push('Invalid plugin dependency (bower). ' + modName + ' is invalid.');
                        }
                    }
                }
            }
        }

        // Handle the callback..
        var error = null;
        if (errors.length > 0) {
            error = new Error('Failed to validate plugin.json file.');
            error.validationErrors = errors;
        }

        return done(error, error == null);
    };

    /**
     * Requires a plugins dependency that has been loaded into the plugins directory.
     *
     * @param {string} uid                          The unique plugin identifier.
     * @param {string} module                       The module to require.
     */
    PluginService.require = function (uid, module) {
        var modulePath = path.join(PLUGIN_DIRECTORY, uid, 'node_modules', module);
        return require(modulePath);
    };

    /**
     * Registers an express router to the arcanus express router stack.
     *
     * @param {string} uid                          The unique plugin identifier.
     * @param {function|string=} p                  The path to register the route under.
     * @param {function} router                     The express router to register.
     */
    PluginService.prototype.registerRouter = function (uid, p, router) {
        var pluginRouterName = 'plugin_' + uid.toLowerCase() + '_router';

        // No path was given..
        if (!router) {
            arcanus.app.use(arcanus.utils.namedFunction(arcanus.utils.toSafePluginName(pluginRouterName), p));
        } else {
            arcanus.app.use(p, arcanus.utils.namedFunction(arcanus.utils.toSafePluginName(pluginRouterName), router));
        }
    };

    // Return the plugin service..
    return PluginService;
};