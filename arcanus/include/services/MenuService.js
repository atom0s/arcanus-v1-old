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

var menuUtils = require('../../utils/menuUtils');

/**
 * Menu Service
 *
 * Exposes functions related to navigation menu handling.
 *
 * @param {object} arcanus                          The arcanus application instance.
 */
module.exports = function MenuServiceModule(arcanus) {
    /**
     * Implements the menu service.
     *
     * @constructor
     */
    function MenuService() {
        // Initialize the base service class..
        arcanus.BaseService.call(this);
    }

    // Inherit from the base service class (required!)..
    MenuService.prototype = Object.create(arcanus.BaseService.prototype);
    MenuService.constructor = arcanus.BaseService;

    /**
     * Returns the alias of the current service. (Must be overridden!)
     *
     * @returns {string}                            The alias of the current service.
     */
    MenuService.prototype.getAlias = function () {
        return 'menuservice';
    };

    /**
     * Initializes the current service. (Must be overridden!)
     *
     * @param {function} done                       The callback to invoke when finished.
     */
    MenuService.prototype.Initialize = function (done) {
        done(null, true);
    };

    /*----------------------------------------------------------------------------------*/
    /* Properties                                                                       */
    /*----------------------------------------------------------------------------------*/

    /**
     * The registered menus within the menu service.
     *
     * Menus are stored as:
     *      {
     *          raw: <the raw menu object>,
     *          compiled: <the compiled menu>,
     *          options: <the menus creation options>
     *      }
     *
     * @private
     * @type {object}
     */
    var __menus = {};

    /*----------------------------------------------------------------------------------*/
    /* Internal (Static) Functions                                                      */
    /*----------------------------------------------------------------------------------*/

    /**
     * Obtains a menus list of alias'.
     *
     * @private
     * @static
     * @param {object} menu                         The menu object.
     * @param {Array} list                          The list to obtain the alias' within.
     */
    function menuGetAliasList(menu, list) {
        if (menu instanceof Array) {
            menu.forEach(function (m) {
                menuGetAliasList(m, list);
            });
        } else {
            list.push(menu.alias);
            if (menu.children) {
                menu.children.forEach(function (m) {
                    menuGetAliasList(m, list);
                });
            }
        }
    }

    /**
     * Determines if a menu has the given alias.
     *
     * @private
     * @static
     * @param {object} menu                         The menu object.
     * @param {string} alias                        The alias to look up.
     */
    function menuHasAlias(menu, alias) {
        var list = [];
        menuGetAliasList(menu, list);

        return list.indexOf(alias) !== -1;
    }

    /**
     * Determines if two menus intersect each other by their alias'.
     *
     * @private
     * @static
     * @param {object} menu1                        The menu object.
     * @param {object} menu2                        The menu object.
     * @returns {boolean}                           True if the menus intersect, false otherwise.
     */
    function menuIntersects(menu1, menu2) {
        var list1 = [];
        var list2 = [];

        menuGetAliasList(menu1, list1);
        menuGetAliasList(menu2, list2);

        return list1.filter(function (n) {
                return list2.indexOf(n) !== -1
            }).length > 0;
    }

    /**
     * Obtains a menu item by its alias.
     *
     * @private
     * @static
     * @param {object} menu                         The menu object.
     * @param {string} alias                        The alias to look up.
     * @returns {object}                            The menu item if found, null otherwise.
     */
    function menuGetItem(menu, alias) {
        var result = null;
        var x = 0;

        if (menu instanceof Array) {
            for (x = 0; x < menu.length; x++) {
                if (result = menuGetItem(menu[x], alias))
                    return result;
            }
            return null;
        } else {
            if (menu.alias === alias)
                return menu;

            if (menu.children) {
                for (x = 0; x < menu.children.length; x++) {
                    if (result = menuGetItem(menu.children[x], alias))
                        return result;
                }
            }

            return null;
        }
    }

    /**
     * Obtains a menu items parent by its alias.
     *
     * @private
     * @static
     * @param {object} menu                         The menu object.
     * @param {string} alias                        The alias to look up.
     * @param {object=} parent                      The item parent used during recursion.
     * @returns {object}                            The menu items parent if found, null otherwise.
     */
    function menuGetItemParent(menu, alias, parent) {
        var result = null;
        var x = 0;

        if (menu instanceof Array) {
            for (x = 0; x < menu.length; x++) {
                if (result = menuGetItemParent(menu[x], alias, menu))
                    return result;
            }
            return null;
        } else {
            if (menu.alias === alias)
                return parent;

            if (menu.children) {
                for (x = 0; x < menu.children.length; x++) {
                    if (result = menuGetItemParent(menu.children[x], alias, menu))
                        return result;
                }
            }

            return null;
        }
    }

    /**
     * Validates a menu ensuring it can be used by the menu service.
     *
     * @private
     * @static
     * @param {object} menu                         The menu object.
     * @returns {boolean}                           True if valid, false otherwise.
     */
    function menuIsValid(menu) {
        if (menu instanceof Array) {
            return menu.every(function (m) {
                return menuIsValid(m);
            });
        } else {
            if (!menuUtils.isValidMenuItem(menu))
                return false;

            if (menu.children) {
                return menu.children.every(function (m) {
                    return menuIsValid(m);
                });
            }

            return true;
        }
    }

    /**
     * Compiles a separator item.
     *
     * @private
     * @static
     * @param {object} item                             The object being compiled.
     * @returns {string}                                The compiled menu item.
     */
    function compileSeparator(item) {
        var itemC = item.class || null;
        var itemD = item.directives || null;
        var itemS = item.style || null;

        return arcanus.utils.format('<li class="%s" role="separator"%s%s></li>',
            (itemC === null) ? 'divider' : itemC,
            (itemS === null) ? '' : ` style="${itemS}"`,
            (itemD === null) ? '' : ` ${itemD}`);
    }

    /**
     * Compiles a link item.
     *
     * @private
     * @static
     * @param {object} item                             The object being compiled.
     * @returns {string}                                The compiled menu item.
     */
    function compileLink(item) {
        var itemC = item.class || null;
        var itemD = item.directives || null;
        var itemS = item.style || null;

        var m = arcanus.utils.format(`<li%s%s%s><a href="${item.href}">`,
            (itemC === null) ? '' : ` class="${itemC}"`,
            (itemS === null) ? '' : ` style="${itemS}"`,
            (itemD === null) ? '' : ` ${itemD}`);

        if (arcanus.utils.isNonEmptyString(item.icon)) {
            m += `<i class="fa ${item.icon}" style="width: 24px; text-align: center;"></i> `;
        }

        m += `${item.title || ''}</a></li>`;

        return m;
    }

    /**
     * Compiles a simple menu.
     *
     * @private
     * @static
     * @param {object} menu                         The menu being compiled.
     * @param {number} depth                        The current depth of the menu.
     * @param {object} compiled                     The compiled array to push compiled parts to.
     */
    function compileSimpleMenu(menu, depth, compiled) {
        if (menu instanceof Array) {
            for (var x = 0; x < menu.length; x++) {
                compileSimpleMenu(menu[x], depth, compiled);
            }
        } else {
            if (!menu.children || menu.children.length === 0) {
                if (menu.separator && menu.separator === true)
                    compiled.push(compileSeparator(menu));
                else
                    compiled.push(compileLink(menu));
            } else {
                var menuC = menu.class || null;
                var menuD = menu.directives || null;
                var menuS = menu.style || null;
                var menuO = menu.ordered || false;

                var m = arcanus.utils.format(`<li%s%s%s>${menu.title || ''}<%s>`,
                    (menuC === null) ? '' : ` class="${menuC}"`,
                    (menuS === null) ? '' : ` style="${menuS}"`,
                    (menuD === null) ? '' : ` ${menuD}`,
                    (menuO === true) ? 'ol' : 'ul');

                compiled.push(m);
                compileSimpleMenu(menu.children, depth + 1, compiled);
                compiled.push((menuO === true) ? '</ol>' : '</ul>');
                compiled.push('</li>');
            }
        }
    }

    /**
     * Compiles a bootstrap based drop-down menu.
     *
     * @private
     * @static
     * @param {object} menu                         The menu being compiled.
     * @param {number} depth                        The current depth of the menu.
     * @param {object} compiled                     The compiled array to push compiled parts to.
     */
    function compileDropdownMenu(menu, depth, compiled) {
        var menuC = menu.class || null;
        var menuD = menu.directives || null;
        var menuS = menu.style || null;

        var m = arcanus.utils.format(`<li%s%s%s><a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">`,
            (menuC === null) ? ' class="dropdown"' : ` class="${menuC}"`,
            (menuS === null) ? '' : ` style="${menuS}"`,
            (menuD === null) ? '' : ` ${menuD}`);

        if (arcanus.utils.isNonEmptyString(menu.icon)) {
            m += `<i class="fa ${menu.icon}" style="width: 24px; text-align: center;"></i> `;
        }

        m += `${menu.title || ''} <span class="caret"></span></a><ul class="dropdown-menu">`;

        compiled.push(m);
        compileMenu(menu.children, depth + 1, compiled);
        compiled.push('</ul></li>');
    }

    /**
     * Compiles a bootstrap based drop-down sub-menu.
     *
     * @private
     * @static
     * @param {object} menu                         The menu being compiled.
     * @param {number} depth                        The current depth of the menu.
     * @param {object} compiled                     The compiled array to push compiled parts to.
     */
    function compileDropdownSubMenu(menu, depth, compiled) {
        var menuC = menu.class || null;
        var menuD = menu.directives || null;
        var menuS = menu.style || null;

        var m = arcanus.utils.format(`<li%s%s%s><a href="#">`,
            (menuC === null) ? ' class="dropdown-submenu"' : ` class="${menuC}"`,
            (menuS === null) ? '' : ` style="${menuS}"`,
            (menuD === null) ? '' : ` ${menuD}`);

        if (arcanus.utils.isNonEmptyString(menu.icon)) {
            m += `<i class="fa ${menu.icon}" style="width: 24px; text-align: center;"></i> `;
        }

        m += `${menu.title || ''}</a><ul class="dropdown-menu">`;

        compiled.push(m);
        compileMenu(menu.children, depth + 1, compiled);
        compiled.push('</ul></li>');
    }

    /**
     * Compiles a complex bootstrap based navigation menu.
     *
     * @private
     * @static
     * @param {object} menu                         The menu being compiled.
     * @param {number} depth                        The current depth of the menu.
     * @param {object} compiled                     The compiled array to push compiled parts to.
     */
    function compileMenu(menu, depth, compiled) {
        if (menu instanceof Array) {
            for (var x = 0; x < menu.length; x++) {
                compileMenu(menu[x], depth, compiled);
            }
        } else {
            if (!menu.children || menu.children.length === 0) {
                if (menu.separator && menu.separator === true)
                    compiled.push(compileSeparator(menu));
                else
                    compiled.push(compileLink(menu));
            } else {
                if (depth === 0)
                    compileDropdownMenu(menu, depth, compiled);
                else
                    compileDropdownSubMenu(menu, depth, compiled);
            }
        }
    }

    /*----------------------------------------------------------------------------------*/
    /* Public Functions                                                                 */
    /*----------------------------------------------------------------------------------*/

    /**
     * Invalidates a compiled menu by its name.
     * If no name is given, all menus will be invalidated.
     *
     * @param {string=} name                         The name of the menu to invalidate.
     */
    MenuService.prototype.invalidate = function (name) {
        if (arcanus.utils.isNonEmptyString(name)) {
            if (__menus[name])
                delete __menus[name].compiled;
        } else {
            Object(__menus).keys().forEach(function (k) {
                delete __menus[name].compiled;
            });
        }
    };

    /**
     * Validates the given menu object.
     *
     * @param {object} menu                         The menu to validate.
     * @returns {boolean}                           True if validate, false otherwise.
     */
    MenuService.prototype.validate = function (menu) {
        return menuIsValid(menu);
    };

    /**
     * Creates a menu.
     *
     * @param {string} name                         The menu name to create.
     * @param {object} menu                         The menu to create.
     * @param {object} options                      The creation options for the menu.
     * @returns {boolean}                           True on success, false otherwise.
     */
    MenuService.prototype.createMenu = function (name, menu, options) {
        // Prevent creating menus with the same name..
        if (this.getMenuRaw(name))
            return false;

        // Validate the menu..
        if (!menuIsValid(menu))
            return false;

        // Default parameters..
        if (!options)
            options = {};

        // Store the menu..
        __menus[name.toLowerCase()] = {
            raw: menu,
            compiled: '',
            options: options
        };

        return true;
    };

    /**
     * Deletes a menu.
     *
     * @param {string} name                         The menu name to delete.
     * @returns {boolean}                           True on success, false otherwise.
     */
    MenuService.prototype.deleteMenu = function (name) {
        var menu = __menus[name.toLowerCase()];
        if (!menu)
            return false;

        // Delete the menu..
        delete __menus[name.toLowerCase()];
        return true;
    };

    /**
     * Obtains a menu.
     *
     * @param {string} name                         The menu name to obtain.
     * @returns {string}                            The compiled menu if found, empty string otherwise.
     */
    MenuService.prototype.getMenu = function (name) {
        // Obtain the menu to compile..
        var menu = __menus[name.toLowerCase()];
        if (!menu)
            return '';

        // Check if the menu is already compiled..
        if (arcanus.utils.isNonEmptyString(menu.compiled))
            return menu.compiled;

        // Obtain the creation options to apply to the menus root element..
        var menuC = menu.options.class || null;
        var menuD = menu.options.directives || null;
        var menuS = menu.options.style || null;
        var menuO = menu.options.ordered || false;

        // Create the root menu element..
        var m = arcanus.utils.format('<%s%s%s%s>',
            (menuO === true) ? 'ol' : 'ul',
            (menuC === null) ? '' : ` class="${menuC}"`,
            (menuS === null) ? '' : ` style="${menuS}"`,
            (menuD === null) ? '' : ` ${menuD}`);

        var compiled = [m];

        if (menu.options.simple && menu.options.simple === true) {
            compileSimpleMenu(menu.raw, 0, compiled);
        } else {
            compileMenu(menu.raw, 0, compiled);
        }

        compiled.push((menuO === true) ? '</ol>' : '</ul>');

        menu.compiled = compiled.join('');
        return menu.compiled;
    };

    /**
     * Obtains a raw menu.
     *
     * @param {string} name                         The menu name to obtain.
     * @returns {object}                            The raw menu if found, null otherwise.
     */
    MenuService.prototype.getMenuRaw = function (name) {
        var rawMenu = __menus[name.toLowerCase()];
        return rawMenu ? rawMenu.raw : null;
    };

    /**
     * Appends a menu item to a menu.
     *
     * @param {string} name                         The menu name to obtain.
     * @param {object} item                         The menu item to append.
     * @param {string=} alias                       The alias of the menu item to append to.
     * @returns {boolean}                           True on success, false otherwise.
     */
    MenuService.prototype.appendMenuItem = function (name, item, alias) {
        // Forward incorrect calls..
        if (item instanceof Array)
            return this.appendMenuItems(name, item, alias);

        // Obtain the menu to append to..
        var menu = __menus[name.toLowerCase()];
        if (!menu) return false;

        // Validate the incoming menu item..
        if (!menuIsValid(item) || menuHasAlias(menu.raw, item.alias) || menuIntersects(menu.raw, item))
            return false;

        // If no alias is given, append to the menu..
        if (!arcanus.utils.isNonEmptyString(alias))
            menu.raw.push(item);
        else {
            // Obtain the item to append to..
            var menuItem = menuGetItem(menu.raw, alias);
            if (!menuItem)
                return false;

            // Ensure the menu item has the children property..
            if (!menuItem.children || !arcanus.utils.isArray(menuItem.children))
                menuItem.children = [];

            // Append the item..
            menuItem.children.push(item);
        }

        // Invalidate the menu..
        this.invalidate(name);
        return true;
    };

    /**
     * Appends multiple menu items to a menu.
     *
     * @param {string} name                         The menu name to obtain.
     * @param {object} items                        The menu items to append.
     * @param {string=} alias                       The alias of the menu item to append to.
     * @returns {boolean}                           True on success, false otherwise.
     */
    MenuService.prototype.appendMenuItems = function (name, items, alias) {
        var self = this;

        // Ensure the incoming items are an array..
        if (!(items instanceof Array))
            return false;

        // Obtain the menu to append to..
        var menu = __menus[name.toLowerCase()];
        if (!menu) return false;

        // Validate the incoming menu items..
        if (!menuIsValid(items) || menuIntersects(menu.raw, items))
            return false;

        // If no alias is given, append to the menu..
        if (!arcanus.utils.isNonEmptyString(alias))
            items.forEach(function (i) {
                menu.raw.push(i);
            });
        else {
            // Forward the appends to the single item handler..
            items.forEach(function (i) {
                self.appendMenuItem(name, i, alias);
            });
        }

        // Invalidate the menu..
        this.invalidate(name);
        return true;
    };

    /**
     * Deletes a menu item from a menu.
     *
     * @param {string} name                         The menu name to delete from.
     * @param {string} alias                        The alias of the menu item to delete.
     * @returns {boolean}                           True on success, false otherwise.
     */
    MenuService.prototype.deleteMenuItem = function (name, alias) {
        // Obtain the menu to delete from..
        var menu = __menus[name.toLowerCase()];
        if (!menu) return false;

        // Obtain the menu item to delete..
        var menuItem = menuGetItem(menu.raw, alias);
        if (!menuItem) return false;

        // Obtain the menu items parent..
        var parent = menuGetItemParent(menu.raw, menuItem.alias);
        if (!parent) return false;

        // Obtain the index of the child..
        var index = -1;
        if (parent.child) {
            index = parent.children.indexOf(menuItem);
            if (index === -1)
                return false;
            if (parent.children.splice(index, 1).length === 0)
                return false;
        } else {
            index = parent.indexOf(menuItem);
            if (index === -1)
                return false;
            if (parent.splice(index, 1).length === 0)
                return false;
        }

        // Invalidate the menu..
        this.invalidate(name);
        return true;
    };

    /**
     * Obtains a menu item.
     *
     * @param {string} name                         The menu name to obtain the item from.
     * @param {string} alias                        The alias of the menu item to obtain.
     * @returns {object}                            The menu item on success, null otherwise.
     */
    MenuService.prototype.getMenuItem = function (name, alias) {
        // Obtain the menu..
        var menu = __menus[name.toLowerCase()];
        if (!menu) return false;

        // Get the menu item..
        return menuGetItem(menu.raw, alias);
    };

    // Return the menu service..
    return MenuService;
};