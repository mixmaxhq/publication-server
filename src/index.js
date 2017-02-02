'use strict';

const _ = require('underscore');
const assert = require('assert');
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
   * @param {Function} errHandler An error handler to pass publication errors
   *    to.
   * @param {Object} server The HTTP server to allow Primus to listen on.
   */
  constructor({authFn, mountPath, errHandler, server} = {}) {
    assert(authFn, 'Must provide an authorization function');

    this._subscriptions = {};
    this._authFn = (req, done) => {
      authFn(req, (err, userId) => {
        // Make the userId available to the session and any publications.
        req.userId = userId;
        done(err);
      });
    };
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

  /**
   * Broadcast a message to all connected clients.
   *
   * @param {Object} msg The message to send to all connected clients.
   */
  broadcast(msg) {
    this._primus.write(msg);
  }

  /**
   * Gracefully shutdowns the publication server.
   *
   * @param {Number} timeout The amount of time we'll give the WebSocket server
   *    to gracefully shutdown.
   * @param {Object} options Any shutdown options that you'd like to pass when
   *    shutting the server down. These are passed through to the Primus
   *    instance, so see https://github.com/primus/primus#destruction for
   *    details.
   */
  shutdown(timeout, options) {
    this._primus.destroy(_.defaults(options, {
      // Don't force the HTTP server to close by default, that's not our job.
      close: false,
      timeout
    }));
  }
}

module.exports = PublicationServer;