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

var BaseService = require('./BaseService');

/**
 * Service Factory
 *
 * Container object to hold registered services for usage within arcanus.
 *
 * @param {object} arcanus                          The arcanus application instance.
 */
module.exports = function ServiceFactoryModule(arcanus) {
    /**
     * Array of loaded services within the service factory.
     *
     * @type {Array}
     */
    var LOADED_SERVICES = {};

    /**
     * Implements the service factory.
     *
     * @constructor
     */
    function ServiceFactory() { }

    /**
     * Registers a service with the service factory.
     *
     * If a service with the same alias already exists, it will be overridden.
     *
     * @param {object} service                      The service to register.
     * @returns {boolean}                           True on success, false otherwise.
     */
    ServiceFactory.prototype.registerService = function (service) {
        try {

            // Create a new instance of the incoming service..
            var instance = new service;

            // Ensure the service inherits from the BaseService object..
            if (!(instance instanceof BaseService)) {
                arcanus.log.error('ServiceFactory: Failed to register new service; invalid base class type.');
                return false;
            }

            // Obtain the services name..
            var name = instance.getAlias();
            if (!arcanus.utils.isNonEmptyString(name)) {
                arcanus.log.error('ServiceFactory: Failed to register new service; invalid service name.');
                return false;
            }

            // Initialize the service..
            instance.Initialize(function (err, status) {
                if (err || status === false) {
                    arcanus.log.error(`ServiceFactory: Failed to register new service; '${name}' service failed to initialize.`);
                    return false;
                }

                // Store the service instance..
                LOADED_SERVICES[name.toLowerCase()] = instance;
                arcanus.log.info(`ServiceFactory: Registered new service: '${name}'`);
                return true;
            });
        } catch (e) {
            console.log.error('ServiceFactory: Failed to register service. Exception occurred.');
            console.log.error(e);
            return false;
        }
    };

    /**
     * Obtains a registered service from the factory.
     *
     * @param {string} name                         The name of the service to obtain.
     * @returns {object}                            The service object if found, null otherwise.
     */
    ServiceFactory.prototype.get = function (name) {
        return LOADED_SERVICES[name.toLowerCase()] || null;
    };

    // Return the service factory..
    return ServiceFactory;
};