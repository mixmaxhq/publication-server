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
   * @param {String} mountPath The URL to mount the listener on.
   * @param {Object} server The HTTP server to allow Primus to listen on.
   */
  constructor({authFn, mountPath, errHandler, server} = {}) {
    this._subscriptions = {};
    this._authFn = authFn;
    this._mountPath = mountPath;
    this._errHandler = errHandler;

    this._primus = new Primus(server, {
      authorization: this._authFn,
      pathname: this._mountPath,
      parser: 'EJSON',
      transformer: 'uws'
    });

    this._primus.on('connection', (spark) => {
      new Session({server: this, spark});
    });
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
}

module.exports = PublicationServer;