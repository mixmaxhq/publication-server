'use strict';

const WebSocketServer = require('ws').Server;
const _ = require('underscore');

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
  constructor(authFn) {
    this._subscriptions = {};
    this._authFn = authFn;
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
    const wss = new WebSocketServer({ server});
    wss.on('connection', (ws) => {
      new Session({server: self, ws, authFn: this._authFn});
    });
  }
}

module.exports = PublicationServer;