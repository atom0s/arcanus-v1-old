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
var os = require('os');
var path = require('path');
var util = require('util');
var extend = require('node.extend');

/**
 * Regular expression to test if a filename is safe.
 *
 * @private
 * @static
 * @type {RegExp}
 */
var SAFE_FILENAME_REGEX = /^[a-zA-Z0-9-_\.]+$/;

/**
 * Regular expression to test if an email is safe.
 *
 * @private
 * @static
 * @type {RegExp}
 */
var SAFE_EMAIL_REGEX = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;

/**
 * Regular expression to test if an url is safe.
 *
 * @private
 * @static
 * @type {RegExp}
 */
var SAFE_URL_REGEX = /^(http|https):\/\/(\w+:?\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@\-\/]))?$/;

/**
 * Regular expression to test if an url (with no host) is safe.
 *
 * @private
 * @static
 * @type {RegExp}
 */
var SAFE_URL_NO_HOST_REGEX = /^\/.*\/?$/;

/**
 * Regular expression to test if a version is safe.
 *
 * @private
 * @static
 * @type {RegExp}
 */
var SAFE_VERSION_REGEX = /^[0-9]+\.[0-9]+\.[0-9]+$/;

/**
 * Implements a set of utility functions useful for various purposes.
 *
 * Extended by the Node.js util class.
 *
 * @constructor
 */
function Util() { }

/**
 * Clones the given object using a JSON trick.
 *
 * @param {object} o                                The object to clone.
 * @returns {object}                                The cloned object.
 */
Util.clone = function (o) {
    return JSON.parse(JSON.stringify(o));
};

/**
 * Deep merges the two given objects.
 * @param {object} f                                The object to merge from.
 * @param {object} t                                The object to merge to.
 * @returns {object}                                The merged object.
 */
Util.deepMerge = function (f, t) {
    return extend(true, t, f);
};

/**
 * Iterates an object.
 *
 * @param {object} o                                The object to iterate.
 * @param {function} f                              The function to invoke on each iteration.
 * @returns {boolean}                               False if fails. No return otherwise.
 */
Util.forEach = function (o, f) {
    var oo = o;
    var ff = f;

    if (util.isArray(o)) {
        // Do nothing on arrays..
    } else if (Util.isObject(o)) {
        oo = Object.getOwnPropertyNames(o);
        ff = function (n, i) {
            f(o[n], n, o, i);
        };
    } else {
        return false;
    }

    oo.forEach(ff);
};

/**
 * Checks if the given object is a function.
 *
 * @param {*} o                                     The object to check.
 * @returns {boolean}                               True if function, false otherwise.
 */
Util.isFunction = function (o) {
    return (typeof o === 'function');
};

/**
 * Tests if the given string is non-empty.
 *
 * @param {string} s                                The string to test.
 * @returns {boolean}                               True if non-empty, false otherwise.
 */
Util.isNonEmptyString = function (s) {
    return Util.isString(s) && s.length > 0;
};
/**
 * Checks if the given object is null or undefined.
 *
 * @param {*} o                                     The object to check.
 * @returns {boolean}                               True if null or undefined, false otherwise.
 */
Util.isNullOrUndefined = function (o) {
    return o === null || typeof o === 'undefined';
};

/**
 * Checks if the given object is an object.
 *
 * @param {*} o                                     The object to check.
 * @returns {boolean}                               True if object, false otherwise.
 */
Util.isObject = function (o) {
    return (typeof o === 'object');
};

/**
 * Checks if the given object is a string.
 *
 * @param {*} o                                     The object to check.
 * @returns {boolean}                               True if string, false otherwise.
 */
Util.isString = function (o) {
    return (typeof o === 'string');
};

/**
 * Tests to ensure a given email is valid.
 *
 * @param {string} s                                The email to test.
 * @returns {boolean}                               True if valid, false otherwise.
 */
Util.isValidEmail = function (s) {
    return Util.isString(s) && s.search(SAFE_EMAIL_REGEX) !== -1;
};

/**
 * Tests to ensure a given email is valid.
 *
 * @param {string} s                                The file name to test.
 * @returns {boolean}                               True if valid, false otherwise.
 */
Util.isValidFileName = function (s) {
    return Util.isString(s) && s.search(SAFE_FILENAME_REGEX) !== -1;
};

/**
 * Tests to ensure a given url is valid.
 *
 * @param {string} s                                The url to test.
 * @returns {boolean}                               True if valid, false otherwise.
 */
Util.isValidUrl = function (s) {
    return Util.isString(s) && (s.search(SAFE_URL_REGEX) !== -1 || s.search(SAFE_URL_NO_HOST_REGEX) !== -1);
};

/**
 * Tests to ensure a given version is valid.
 *
 * @param {string} s                                The version to test.
 * @returns {boolean}                               True if valid, false otherwise.
 */
Util.isValidVersion = function (s) {
    return Util.isString(s) && s.search(SAFE_VERSION_REGEX) !== -1;
};

/**
 * Merges two objects together. (Not deep!)
 *
 * @param {object} f                                The object to merge from.
 * @param {object} t                                The object to merge to.
 * @returns {object}                                The merged object.
 */
Util.merge = function (f, t) {
    Util.forEach(f, function (v, n) {
        t[n] = v;
    });

    return t;
};

/**
 * Creates the given directory structure from the given path information. (Synchronous)
 *
 * @throws                                          Will throw an error if the dir argument is invalid.
 * @param {string} dir                              The full path to create.
 * @param {boolean} isFileName                      Boolean if the last part of the path is a file name.
 */
Util.mkdirSync = function (dir, isFileName) {
    if (!Util.isString(dir)) {
        throw new Error('mkdirSync: dir must be a valid path.');
    }

    var pieces = dir.split(path.sep);
    var curr = '';
    var isWindows = os.type().toLowerCase().indexOf('windows') !== -1;

    pieces.forEach(function (p, i) {
        if (p.length === 0 || (isFileName && i >= pieces.length - 1))
            return;

        curr += (isWindows && i === 0 ? '' : path.sep) + p;
        if (!fs.existsSync(curr))
            fs.mkdirSync(curr);
    });
};

/**
 * Converts the given name to a safe plugin name.
 *
 * @param {string} name                             The name to convert to a safe name.
 * @returns {string}                                The safe name.
 */
Util.toSafePluginName = function (name) {
    name = name.replace(/[:\-\s\.]/gi, '_');
    return name;
};

/**
 * Merges the Node.js utilities with ours.
 */
Util.merge(util, Util);

/**
 * Overrides the Node.js inherits method to include static functions and prototype properties.
 *
 * @param {function} constructor                    The base class constructor.
 * @param {function} superConstructor               The super class constructor to inherit from.
 */
Util.inherits = function (constructor, superConstructor) {
    // Validate the incoming objects..
    if (Util.isNullOrUndefined(constructor) || Util.isNullOrUndefined(superConstructor))
        throw new Error('Invalid types attempting to be inherited! Must be objects or prototypes!');

    // Perform the default node inherits..
    util.inherits(constructor, superConstructor);

    // Merge the types together..
    Util.merge(superConstructor, constructor);
};

/**
 * Creates a named function from an anonymous one.
 *
 * Credit to:
 *      Nate Ferrero <http://stackoverflow.com/a/22880379/1080150>
 *
 * @param {string} name                             The name to give the function.
 * @param {function} func                           The anonymous function to name.
 * @returns {function}                              The named function.
 */
Util.namedFunction = function (name, func) {
    return (new Function(`return function (call) {
        return function ${name} () {
            return call(this, arguments);
        }
    }`)())(Function.apply.bind(func));
};

// Export this module..
module.exports = Util;