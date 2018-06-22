/**
 * Entry Point
 * Belongs to Decentraleyes.
 *
 * @author      Thomas Rientjes
 * @since       2014-05-30
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

var webextension = null;

var self = require('sdk/self');
var tabs = require('sdk/tabs');

/**
 * Gets and sets add-on specific preferences.
 * @var {object} simplePreferences
 */
var simplePreferences = require('sdk/simple-prefs');

var Interceptor = require('./interceptor');
var LoadWatcher = require('./load-watcher');

/**
 * Variables
 */

var preferences = simplePreferences.prefs;
var webextensionPort = null;

/**
 * Initializations
 */

var interceptor = new Interceptor();
var loadWatcher = new LoadWatcher();

var featurelessVersions = {

    '1.3.7': true
};

/**
 * Main
 */

// Executed as soon as the add-on is loaded.
exports.main = function (options) {

    // Initialize add-on state.
    interceptor.register();
    loadWatcher.register();

    // Display the release notes if desired.
    if (preferences.showReleaseNotes) {

        let loadReason = options.loadReason;

        if (loadReason === 'install' || (loadReason === 'upgrade' && !featurelessVersions[self.version])) {

            if (preferences['sdk.baseURI']) {
                tabs.open(`${preferences['sdk.baseURI']}static/release-notes.html`);
            }
        }
    }

    try {
        webextension = require('sdk/webextension');
    } catch (exception) {
        return;
    }

    // Initialize the embedded WebExtension.
    webextension.startup().then(({browser}) => {

        browser.runtime.onConnect.addListener((port) => {

            if (port.name === 'webextension') {

                webextensionPort = port;

                simplePreferences.on('', function (preferenceName) {

                    let content = null;

                    if (preferenceName === 'amountInjected') {
                        return;
                    }

                    if (preferenceName === 'domainWhitelist') {

                        let domainWhitelist = preferences['domainWhitelist'];

                        content = {
                            'whitelistedDomains': _parseDomainWhitelist(domainWhitelist)
                        };

                    } else {

                        content = {
                            [preferenceName]: preferences[preferenceName]
                        };
                    }

                    port.postMessage({
                        'subject': 'update-preferences',
                        'content': content
                    });
                });

                let domainWhitelist = preferences['domainWhitelist'];

                port.postMessage({
                    'subject': 'migrate-preferences',
                    'content': {
                        'amountInjected': preferences['amountInjected'],
                        'blockMissing': preferences['blockMissing'],
                        'whitelistedDomains': _parseDomainWhitelist(domainWhitelist),
                        'showReleaseNotes': preferences['showReleaseNotes']
                    }
                });
            }
        });
    });
};

// Executed as soon as the add-on is unloaded.
exports.onUnload = function () {

    // Clean up add-on state.
    interceptor.unregister();
};

// Sends injection updates to the WebExtension.
exports.broadcastInjection = function () {

    if (webextensionPort !== null) {

        webextensionPort.postMessage({
            'subject': 'register-injection'
        });
    }
};

/**
 * Private Methods
 */

function _parseDomainWhitelist (value) {

    let whitelistedDomains = {};

    value.split(';').forEach(function (domain) {
        whitelistedDomains[_normalizeDomain(domain)] = true;
    });

    return whitelistedDomains;
}

function _normalizeDomain (domain) {

    domain = domain.toLowerCase().trim();

    if (domain.startsWith('www.')) {
        domain = domain.slice(4);
    }

    return domain;
}
