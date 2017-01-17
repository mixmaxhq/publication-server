'use strict';

const _ = require('underscore');
const Primus = require('primus');

const Session = require('./session');

/**
 * A PublicationServer handles registering publications and creating sessions
 * for incoming connections.
 */
class PublicationServer {
  /**
   * Creates the PublicationServer with the given function for authenticating
   * new connections.
   *
   * @param {Function} authFn The function for authenticating connections.
   */
  constructor({authFn, mountPath} = {}) {
    this._subscriptions = {};
    this._authFn = authFn;
    this._mountPath = mountPath;
  }

  /**
   * Registers the given publication so that clients can subscribe to it.
   *
   * @param {String} name The name of the publication, it must be globally
   *    unique.
   * @param {Function} func The publication function to be run for
   *    subscriptions.
   */
  publish(name, func) {
    if (this._subscriptions[name]) throw new Error(`handler ${name} already defined`);

    this._subscriptions[name] = func;
  }

  /**
   * Attaches the publication server to the given HTTP server.
   *
   * @param {Object} server The server to connect the WebSocketServer to.
   */
  attachToServer(server) {
    const self = this;
    const primus = new Primus(server, {
      authorization: this._authFn,
      pathname: this._mountPath,
      parser: 'EJSON',
      transformer: 'uws'
    });

    primus.on('connection', (spark) => {
      new Session({server: self, spark});
    });
  }
}

module.exports = PublicationServer;