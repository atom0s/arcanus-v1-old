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

var path = require('path');

/**
 * Prepares the arcanus framework for usage.
 */
module.exports = function () {
    /**
     * The base arcanus object to hold the various framework elements.
     *
     * @private
     * @type {object}
     */
    var arcanus = {};

    // Prepare the arcanus utils class object..
    arcanus.utils = require(path.join(__dirname, 'utils'));

    // Prepare the arcanus logging instance..
    arcanus.Logger = require(path.join(__dirname, 'logging'))(arcanus);
    arcanus.log = new arcanus.Logger().get();

    // Display the arcanus header..
    var arcanusVersion = require('../package.json').version;
    arcanus.log.info('-------------------------------------------------------------------------');
    arcanus.log.info(`arcanus v${arcanusVersion} (c) 2015-2016 atom0s [atom0s@live.com]`);
    arcanus.log.info('-------------------------------------------------------------------------');

    // Store the loaded configurations..
    arcanus.Configuration = require(path.join(__dirname, 'config'))(arcanus);
    arcanus.config = new arcanus.Configuration().get();

    // Prepare the arcanus caching object..
    arcanus.Cache = require('node-cache');
    arcanus.cache = new arcanus.Cache({ stdTTL: 0, checkperiod: 300 });

    // Prepare the arcanus service factory..
    arcanus.services = new (require(path.join(__dirname, 'services/ServiceFactory'))(arcanus));

    // Prepare the base service for services to inherit from..
    arcanus.BaseService = require(path.join(__dirname, 'services/BaseService'));

    // Register internal services to arcanus..
    var MenuService = require(path.join(__dirname, 'services/MenuService'))(arcanus);
    var PluginService = require(path.join(__dirname, 'services/PluginService'))(arcanus);
    var ViewService = require(path.join(__dirname, 'services/ViewService'))(arcanus);

    arcanus.services.registerService(MenuService);
    arcanus.services.registerService(PluginService);
    arcanus.services.registerService(ViewService);

    // Return the initialized arcanus application..
    return arcanus;
};