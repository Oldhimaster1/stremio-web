// Copyright (C) 2017-2023 Smart code 203358507

const EventEmitter = require('eventemitter3');
const CoreTransport = require('./CoreTransport');

// Preinstalled addons URLs
const PREINSTALLED_ADDONS = [
    "https://torrentio.strem.fun/lite/manifest.json"
];

function Core(args) {
    let active = false;
    let error = null;
    let starting = false;
    let transport = null;

    // Start with preinstalled addons in memory
    let installedAddons = [...PREINSTALLED_ADDONS];

    const events = new EventEmitter();

    function onTransportInit() {
        active = true;
        error = null;
        starting = false;
        onStateChanged();
    }

    function onTransportError(args) {
        console.error(args);
        active = false;
        error = new Error('Stremio Core Transport initialization failed', { cause: args });
        starting = false;
        onStateChanged();
        transport = null;
    }

    function onStateChanged() {
        events.emit('stateChanged');
    }

    Object.defineProperties(this, {
        active: {
            configurable: false,
            enumerable: true,
            get: function() { return active; }
        },
        error: {
            configurable: false,
            enumerable: true,
            get: function() { return error; }
        },
        starting: {
            configurable: false,
            enumerable: true,
            get: function() { return starting; }
        },
        transport: {
            configurable: false,
            enumerable: true,
            get: function() { return transport; }
        },
        installedAddons: {
            configurable: false,
            enumerable: true,
            get: function() { return installedAddons; }
        }
    });

    // Start Core Transport
    this.start = function() {
        if (active || error instanceof Error || starting) return;

        starting = true;
        transport = new CoreTransport(args);

        // --- PATCH: Register preinstalled addons with transport ---
        PREINSTALLED_ADDONS.forEach(url => {
            if (transport && typeof transport.registerAddons === 'function') {
                transport.registerAddons(url);
            }
        });

        transport.on('init', onTransportInit);
        transport.on('error', onTransportError);
        onStateChanged();
    };

    // Stop Core Transport
    this.stop = function() {
        active = false;
        error = null;
        starting = false;
        onStateChanged();
        if (transport !== null) {
            transport.removeAllListeners();
            transport = null;
        }
    };

    // Event listeners
    this.on = function(name, listener) {
        events.on(name, listener);
    };

    this.off = function(name, listener) {
        events.off(name, listener);
    };

    // Optional: allow adding more addons at runtime
    this.addAddon = function(url) {
        if (!installedAddons.includes(url)) {
            installedAddons.push(url);
            if (transport && typeof transport.registerAddons === 'function') {
                transport.registerAddons(url); // register dynamically
            }
            onStateChanged();
        }
    };
}

module.exports = Core;