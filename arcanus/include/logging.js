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
var utils = require('./utils.js');
var winston = require('winston');

/**
 * Implements logging functionality for use within arcanus.
 *
 * @param {object} arcanus                          The arcanus application instance.
 */
module.exports = function LoggerModule(arcanus) {
    /**
     * Logger class constructor.
     *
     * @constructor
     */
    function Logger() {
        var self = this;

        // Obtain the debug output level to use..
        var debugLevel = process.env.DEBUG_LEVEL || 'debug';

        // Setup the default winston transports..
        this.transports = [
            new (winston.transports.Console)({ colorize: true, level: debugLevel, timestamp: false, label: '' })
        ];

        // Setup the path to the arcanus log file..
        arcanus.utils.mkdirSync(path.join(__dirname, '..', 'logs', 'arcanus.log'), true);

        // Setup the file transport to log to disk..
        var fileTransport = new (winston.transports.File)({
            filename: path.join(__dirname, '..', 'logs', 'arcanus.log'),
            level: debugLevel,
            timestamp: true
        });
        this.transports.push(fileTransport);

        // Initialize winston..
        this.logger = new (winston.Logger)({
            transports: this.transports,
            level: debugLevel,
            padLevels: true
        });

        // Implement log streaming for request logging..
        this.logger.stream = {
            write: function (msg) {
                self.logger.info(msg.trim());
            }
        };
    }

    /**
     * Returns the underlying logger object.
     *
     * @returns {object}                            The winston logger object.
     */
    Logger.prototype.get = function () {
        return this.logger;
    };

    // Return the logger module..
    return Logger;
};