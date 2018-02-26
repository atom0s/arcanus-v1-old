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
var async = require('async');
var bodyParser = require('body-parser');
var callerId = require('caller-id');
var cookieParser = require('cookie-parser');
var express = require('express');
var favicon = require('serve-favicon');
var flash = require('connect-flash');
var helmet = require('helmet');
var http = require('http');
var https = require('https');
var minifyHtml = require('express-minify-html');
var morgan = require('morgan');
var passport = require('passport');
var session = require('express-session');
var vash = require('vash');

// Obtain the current arcanus version from the package.json..
var arcanusVersion = require('./package.json').version;

/**
 * Normalizes a path preparing it view rendering within vash.
 *
 * @private
 * @static
 * @param {String} filepath                         The file path to normalize.
 * @param {String} view                             The view path where to load the file from.
 * @param {Object} options                          The options of the engine.
 * @returns {String}                                The normalized path.
 */
vash.__normalizePath = function (filepath, view, options) {
    // Handle non-absolute paths..
    if (filepath.indexOf(path.normalize(view)) === -1)
        filepath = path.join(view, filepath);

    if (!path.extname(filepath))
        filepath += '.' + (options.settings['view engine'] || 'vash');

    return filepath;
};

/**
 * Overrides the vash loadFile function to enable usage of Express 4.10.x multiple
 * view directories feature.
 *
 * Views are used in the order of last in, first used to follow an override order.
 *
 * This hack/fix does present a new problem with multiple view locations. Take the following example:
 *
 *      View paths are currently loaded as:
 *          - /project/path/here/folder2/
 *          - /project/path/here/folder1/
 *
 * If folder1 has an index.html that uses @html.extend('layout', ... this function will attempt to load
 * that layout from folder2 first. If it exists, it will be used. This can present a problem when folder1
 * is trying to extend its own templates. As-is, there is no way to tell what base template is asking for
 * this new template to be loaded.
 *
 * @private
 * @static
 * @param {String} filepath                         The file to load.
 * @param {Object} options                          The options of the engine.
 * @param {Function} cb                             The callback to invoke when this function completes.
 */
vash.loadFile = function (filepath, options, cb) {
    // Require some needed vash libraries..
    var copyrtl = require('vash/lib/util/copyrtl');
    var helpers = require('vash/runtime').helpers;

    // Force false to ensure we attempt to load templates..
    helpers.config.browser = false;

    // Prepare the options and create some needed vars..
    options = copyrtl({}, vash.config, options || {});
    var browser = helpers.config.browser, tpl;

    // Handle the request if we are not a browser and we have valid view data..
    if (!browser && options.settings && options.settings.views && !path.extname(filepath)) {
        // If we are not an array, treat like we are a normal string..
        if (!(options.settings.views instanceof Array)) {
            filepath = vash.__normalizePath(filepath, options.settings.views, options);
        } else {
            // Loop each view location (last come, first served)..
            options.settings.views.some(function (v) {
                var temp = vash.__normalizePath(filepath, v, options);
                if (fs.existsSync(temp)) {
                    filepath = temp;
                    return true;
                }
            });
        }
    }

    try {
        tpl = options.cache || browser
            ? helpers.tplcache[filepath] || (helpers.tplcache[filepath] = vash.compile(fs.readFileSync(filepath, 'utf8')))
            : vash.compile(fs.readFileSync(filepath, 'utf8'));
        cb && cb(null, tpl);
    } catch (e) {
        cb && cb(e, null);
    }
};

/**
 * Adds a helper to the vash template engine to render Json objects.
 * Usage: @html.toJson(val)
 *
 * @param {Object} arg                              An object to convert to json.
 */
vash.helpers.toJson = function (arg) {
    return JSON.stringify(arg);
};

/**
 * Implements the main arcanus application.
 * Prepares the framework for usage.
 * Start the server to listen for incoming requests.
 *
 * @constructor
 */
function Arcanus() {
    /**
     * The internal base arcanus object.
     *
     * @type {object}
     */
    var arcanus = require('./include')();

    /**
     * Initializes Express.js and prepares it for usage.
     *
     * @param {function} callback                   The callback to continue the initialization chain.
     */
    this.initializeExpress = function (callback) {
        // Initialize the express application instance..
        arcanus.app = express();
        arcanus.app.use(helmet());
        
        // Initialize the request logger..
        arcanus.app.use(morgan('combined', { 'stream': arcanus.log.stream }));

        // Build the array of possible view path locations..
        var viewPaths = [
            path.join(__dirname, '/views'),
            path.join(__dirname, '/plugins')
        ];

        // Initialize the vash view engine..
        arcanus.app.engine('html', vash.__express);
        arcanus.app.set('view engine', 'html');
        arcanus.app.set('views', viewPaths);

        // Initialize the Express parsers..
        arcanus.app.use(cookieParser());
        arcanus.app.use(session({
            secret: arcanus.config.site.cookieSecret, resave: true, saveUninitialized: true
        }));
        arcanus.app.use(bodyParser.urlencoded({ extended: true }));
        arcanus.app.use(bodyParser.json());

        // Initialize the content middleware..
        arcanus.app.use('/public', require('less-middleware')(path.join(__dirname, 'public')));
        arcanus.app.use('/public', express.static(path.join(__dirname, 'public')));
        arcanus.app.use('/public', express.static(path.join(__dirname, 'bower_components')));

        // Override the 'x-powered-by' header..
        arcanus.app.set('x-powered-by', false);

        /**
         * Overrides the Express.js res.render function to handle plugin based views.
         *
         * This override will obtain the callie of the res.render function to determine if it was
         * invoked from within a plugin. This is used to allow view overriding to get a 'best-match'
         * view while using plugins. Check the ViewService.getBestMatchView documentation for more info.
         *
         * @param {object} req                      The request object.
         * @param {object} res                      The response object.
         * @param {function} next                   The callback function to continue the request chain.
         */
        arcanus.app.use(function (req, res, next) {
            // Set custom headers..
            res.setHeader('X-Powered-By', 'arcanus framework by atom0s');

            // Override the res.render function..
            var render = res.render;
            res.render = function (view, options, cb) {
                // Obtain the view service..
                var viewService = arcanus.services.get('viewservice');
                if (viewService) {
                    // Obtain the caller of the res.render function..
                    var caller = callerId.getData();

                    // Obtain the best match view..
                    view = viewService.getBestMatchView(view, caller.filePath);
                }

                // Invoke the original res.render function..
                return render.call(this, view, options, cb);
            };

            // Continue the request chain..
            next();
        });

        return callback();
    };

    /**
     * Initializes Passport.js and prepares it for usage.
     *
     * @param {function} callback                   The callback to continue the initialization chain.
     */
    this.initializePassport = function (callback) {
        arcanus.passport = passport;
        arcanus.app.use(flash());
        arcanus.app.use(passport.initialize());
        arcanus.app.use(passport.session());

        return callback();
    };

    /**
     * Initializes the base model object passed to responses.
     *
     * @param {function} callback                   The callback to continue the initialization chain.
     */
    this.initializeResponseModel = function (callback) {
        /**
         * Prepares the base response model object.
         *
         * @param {object} req                      The request object.
         * @param {object} res                      The response object.
         * @param {function} next                   The callback function to continue the request chain.
         */
        arcanus.app.use(function (req, res, next) {
            // Skip client library requests..
            if (req.xhr)
                return next();

            // Build the response model..
            res.model = {
                site: {
                    name: arcanus.config.site.name,
                    path: arcanus.config.site.path,
                    meta: {
                        applicationName: 'arcanus',
                        author: 'atom0s',
                        creator: 'atom0s',
                        description: arcanus.config.site.meta.description,
                        generator: 'arcanus',
                        keywords: arcanus.config.site.meta.keywords,
                        publisher: 'arcanus',
                        title: 'arcanus'
                    }
                }
            };

            // Set title function..
            res.model.site.meta.setTitle = function (title) {
                res.model.site.meta.title = (arcanus.config.site.name || 'arcanus') + ' &bull; ' + title;
            };

            // Set the arcanus model data..
            res.model.arcanus = {};
            res.model.arcanus.author = 'atom0s';
            res.model.arcanus.version = arcanusVersion;

            // Set the user of the request..
            res.model.user = req.user || null;
            if (res.model.user)
                delete res.model.user.password;

            // Set the error messages for the model..
            res.model.errorMessage = req.flash('error') || null;
            res.model.successMessage = req.flash('success') || null;
            res.model.warningMessage = req.flash('warning') || null;

            // Add menu service features to the res model..
            res.model.menu = {};
            res.model.menu.get = function (name) {
                return arcanus.services.get('menuservice').getMenu(name);
            };

            // Continue the request chain..
            next();
        });

        return callback();
    };

    /**
     * Initializes the plugin service by loading all enabled plugins.
     *
     * @param {function} callback                   The callback to continue the initialization chain.
     */
    this.initializePlugins = function (callback) {
        // Obtain the plugin service..
        var pluginService = arcanus.services.get('pluginservice');
        if (!pluginService)
            throw new Error('Critical Error: Plugin service is invalid or missing.');

        // Load the enabled plugins..
        pluginService.loadPlugins(function (err, result) {
            return callback(err);
        });
    };

    /**
     * Initializes the base routes used by arcanus if no overrides are implemented.
     *
     * @param {function} callback                   The callback to continue the initialization chain.
     */
    this.initializeBaseRoutes = function (callback) {
        /**
         * Default route handler to display the arcanus about screen.
         *
         * @param {object} req                      The request object.
         * @param {object} res                      The response object.
         * @param {function} next                   The callback function to continue the request chain.
         */
        arcanus.app.get('/', function (req, res, next) {
            return res.render('arcanus/about', res.model);
        });

        /**
         * Handles all non-handled requests. Either displays a 404 page or
         * returns a json string based on the requests accepts header.
         *
         * @param {object} req                      The request object.
         * @param {object} res                      The response object.
         * @param {function} next                   The callback function to continue the request chain.
         */
        arcanus.app.use(function (req, res, next) {
            var err = new Error('Requested resource was not found.');
            err.request = req.originalUrl;
            err.status = 404;

            // Store the error in the result model..
            res.model.error = err;
            res.status = 404;

            // Render the error page if the request accepts it..
            if (req.accepts('html')) {
                res.render('arcanus/error', res.model);
                return;
            }

            // Respond with a json string if the request accepts it..
            if (req.accepts('json')) {
                res.send({ error: 'Requested resource was not found.', status: 404, request: req.originalUrl });
                return;
            }

            // Default response with plain text..
            res.type('text').send('Requested resource was not found.');
        });

        /**
         * Default error-handling middleware. This should never get hit, but in the
         * event that it does, a 500 error will be returned.
         *
         * @param {object} err                      The error object that got us to this point.
         * @param {object} req                      The request object.
         * @param {object} res                      The response object.
         * @param {function} next                   The callback function to continue the request chain.
         */
        arcanus.app.use(function (err, req, res, next) {
            // Ensure the model is valid..
            if (!res.model)
                res.model = {};

            // Store the error in the model..
            res.model.error = err;
            res.model.error.request = req.originalUrl;
            res.model.error.status = err.status || 500;

            // Set the result status..
            res.status(err.status || 500);

            // Render the error page..
            res.render('arcanus/error', res.model);
        });

        return callback();
    };

    /**
     * Initializes the favorite icon handler via the plugin system.
     *
     * @param {function} callback                   The callback to continue the initialization chain.
     */
    this.initializeFavoriteIcon = function (callback) {
        arcanus.services.get('pluginservice').getFavIcon(function (err, result) {
            if (err)
                return callback(new Error('Could not retrieve a valid favicon!'));

            arcanus.app.use(favicon(result));
            return callback();
        });
    };

    /**
     * Initializes the Http server to listen for client requests.
     *
     * @param {function} callback                   The callback to continue the initialization chain.
     */
    this.initializeServer = function (callback) {
        /**
         * Normalizes the given port from a string.
         *
         * @param {string} port                     The port to normalize. (Can be a number or named pipe.)
         * @returns {*}                             The normalized port on success, false otherwise.
         */
        var normalize = function (port) {
            var p = parseInt(port, 10);
            if (isNaN(p))
                return port;
            return p >= 0 ? p : false;
        };

        // Normalize the port to use with arcanus..
        arcanus.app.set('port', normalize(arcanus.config.server.port));

        // Create the server instance..
        if (arcanus.config.server.https === true) {
            arcanus.server = https.createServer(arcanus.config.server.certopts, arcanus.app);
        } else {
            arcanus.server = http.createServer(arcanus.app);
        }

        arcanus.server.on('error', function (e) {
            switch (e.code) {
                case 'EACCES':
                    arcanus.log.error('HttpServer: Failed to start server; address requires elevated privileges.');
                    break;
                case 'EADDRINUSE':
                    arcanus.log.error('HttpServer: Failed to start server; port is already in use.');
                    break;
                default:
                    arcanus.log.error('HttpServer: Server error occurred: ' + e);
                    break;
            }

            // Kill the process..
            process.exit(1);
        });

        return callback();
    };

    /**
     * Starts the arcanus application.
     */
    this.start = function () {
        // Build the tasks array to initialize arcanus..
        var tasks = [
            this.initializeExpress,
            this.initializePassport,
            this.initializeResponseModel,
            this.initializePlugins,
            this.initializeFavoriteIcon,
            this.initializeBaseRoutes,
            this.initializeServer
        ];

        // Run the initialization tasks to start arcanus..
        async.series(tasks, function (err) {
            if (err)
                throw err;

            arcanus.server.listen(arcanus.app.get('port'), function () {
                arcanus.log.info('-------------------------------------------------------------------------');
                arcanus.log.info('Initialization complete!');
                arcanus.log.info('-------------------------------------------------------------------------');
                arcanus.log.info(`arcanus is listening on: ${arcanus.app.get('port')}`);
                arcanus.log.info('-------------------------------------------------------------------------');
            });
        });
    };

    /**
     * Returns the base arcanus object.
     *
     * @returns {object}                            Returns the base arcanus object.
     */
    this.get = function () {
        return arcanus;
    };
}

// Export arcanus if this was loaded as a child script..
// -- Explicit check for iisnode. interceptor.js will be the main parent when loaded
//    under IIS using iisnode. This ensures that arcanus will be loaded as a parent.
if (module.parent && module.parent.filename.indexOf('iisnode') === -1) {
    module.exports = Arcanus;
} else {
    // Start the application..
    var arcanus = new Arcanus();
    arcanus.start();
}