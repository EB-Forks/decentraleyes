/**
 * Load Watcher
 * Belongs to Decentraleyes.
 *
 * @author      Thomas Rientjes
 * @since       2016-02-04
 * @license     MPL 2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

/**
 * Imports
 */

var {Class} = require('sdk/core/heritage');
var {Unknown, Factory} = require('sdk/platform/xpcom');
var {Cc, Ci, Cu} = require('chrome');

var xpcom = require('sdk/platform/xpcom');

var categoryManager = Cc['@mozilla.org/categorymanager;1']
    .getService(Ci.nsICategoryManager);

/**
 * Resource version mappings.
 * @var {object} mappings
 */
var mappings = require('./mappings');

/**
 * Retains data across application restarts.
 * @var {object} simpleStorage
 */
var simpleStorage = require('sdk/simple-storage');

/**
 * Constants
 */

const CONTRACT_ID = '@decentraleyes.org/load-watcher;1';
const SCRIPT_CONTENT_TYPE = Ci.nsIContentPolicy.TYPE_SCRIPT;
const SCRIPT_ELEMENT = Ci.nsIDOMHTMLScriptElement;
const REQUEST_ACCEPTATION = Ci.nsIContentPolicy.ACCEPT;

/**
 * Variables
 */

var LoadWatcher, storage, undetectableTaintedDomains, factory, unload;
storage = simpleStorage.storage;

/**
 * Tainted domains that are not automatically detectable.
 * @var {object} undetectableTaintedDomains
 */
undetectableTaintedDomains = {

    'identi.ca': true,
    'minigames.mail.ru': true,
    'passport.twitch.tv': true,
    'ya.ru': true,
    'yadi.sk': true
};

/**
 * Initializations
 */

Object.extend = function (destination, source) {

    for (let property in source) {

        if (source.hasOwnProperty(property)) {
            destination[property] = source[property];
        }
    }

    return destination;
};

storage.taintedDomains = storage.taintedDomains || {};
storage.taintedDomains = Object.extend(storage.taintedDomains, undetectableTaintedDomains);

/**
 * Load Watcher Class
 */

LoadWatcher = new Class({

    'extends': Unknown,
    'interfaces': ['nsIContentPolicy'],

    // eslint-disable-next-line quote-props
    get wrappedJSObject () {
        return this;
    },

    'register': function () {

        categoryManager.deleteCategoryEntry('content-policy', CONTRACT_ID, false);
        categoryManager.addCategoryEntry('content-policy', CONTRACT_ID, CONTRACT_ID, false, true);
    },

    'shouldLoad': function (contentType, contentLocation, requestOrigin, node) {

        let contentHost;

        try {
            contentHost = contentLocation.host;
        } catch (exception) {

            // Accept the resource load request.
            return REQUEST_ACCEPTATION;
        }

        if (contentType === SCRIPT_CONTENT_TYPE && mappings[contentHost]) {

            if (node instanceof SCRIPT_ELEMENT) {

                if (node.hasAttribute('crossorigin') || node.hasAttribute('integrity')) {

                    // Add corresponding origin domain to the list of tainted domains.
                    storage.taintedDomains[requestOrigin.host] = true;
                }
            }
        }

        // Accept the resource load request.
        return REQUEST_ACCEPTATION;
    }
});

/**
 * Load Watcher Factory
 */

factory = Factory({

    'contract': CONTRACT_ID,
    'Component': LoadWatcher,
    'unregister': false
});

/**
 * Unregister
 */

unload = require('sdk/system/unload');

unload.when(function () {

    function trueUnregister () {

        categoryManager.deleteCategoryEntry('content-policy', CONTRACT_ID, false);

        try {
            xpcom.unregister(factory);
        } catch (exception) {
            Cu.reportError(exception);
        }
    }

    if ('dispatch' in Cu) {
        Cu.dispatch(trueUnregister, trueUnregister);
    } else {
        Cu.import('resource://gre/modules/Services.jsm');
        Services.tm.mainThread.dispatch(trueUnregister, 0);
    }
});

/**
 * Exports
 */

module.exports = LoadWatcher;
