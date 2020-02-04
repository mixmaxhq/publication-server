'use strict';

const _ = require('underscore');
const uuid = require('node-uuid');

const Subscription = require('./subscription');

/**
 * A Session represents the state for a given session. Currently, this is
 * primarily a wrapper for a spark and the subscriptions that a connection
 * has subscribed to.
 */
class Session {
  /**
   * Constructs a session for a given Primus spark.
   *
   * @param {Object} server The PublicationServer that created this Session.
   * @param {Object} spark The Primus spark that this session has access to.
   */
  constructor({ server, spark } = {}) {
    this.server = server;
    this.spark = spark;
    this._subscriptions = {};

    this.handlers = {
      sub: this.subscribe.bind(this),
      unsub: this.unsubscribe.bind(this),
      connect: this.connect.bind(this),
      ping: this.ping.bind(this),
    };

    // Set some state on the session.
    this._waitingForConnect = true;
    this.userId = spark.request.userId;
    this.isRunning = true;
    this.attachEventHandlers();
  }

  /**
   * Sends the given payload over the spark.
   * @param {Object} payload The payload to send over the spark. This must be
   *    EJSON serializable.
   */
  send(payload) {
    this.spark.write(payload);
  }

  /**
   * @typedef {Object} ConnectMessage
   * @property {String} msg The message type.
   * @property {String} version The DDP protocol version the client would like
   *    to use.
   * @property {String} session An optional session ID, only provided if the
   *    client is attempting to reconnect.
   * @property {String[]} support Protocol versions that the client supports.
   */

  /**
   * Handles incoming connect messages as specified in the spec:
   * https://github.com/meteor/meteor/blob/master/packages/ddp/DDP.md#messages
   * @param {ConnectMessage} msg The connect message.
   */
  connect(msg) {
    // We only support version '1' currently, not 'pre1' or 'pre2'.
    if (msg.version !== '1') {
      this.send({
        msg: 'failed',
        version: '1',
      });
      this.stop();
      return;
    }

    if (msg.session) {
      this._sessionId = msg.session;
    } else {
      this._sessionId = uuid.v4();
    }

    this._waitingForConnect = false;
    this.send({
      msg: 'connected',
      session: this._sessionId,
    });
  }

  /**
   * Received a ping request from the client.
   */
  ping(msg) {
    var resp = {
      msg: 'pong',
    };
    if (msg.id) resp.id = msg.id;
    this.send(resp);
  }

  /**
   * @typedef {Object} SubMessage
   * @property {String} msg The message type.
   * @property {String} id The subscription ID (assigned by the client).
   * @property {String} name The name of the publication to subscribe to.
   * @property {Array} params Params to be passed to the publication.
   */

  /**
   * Subscribes the client to the specified publication.
   * @param {SubMessage} msg The subscription message.
   */
  subscribe(msg) {
    if (this._waitingForConnect) {
      this.send({
        msg: 'error',
        reason: 'connect-must-be-first',
        offendingMessage: msg,
      });
      return;
    }

    if (this._subscriptions[msg.id]) {
      // This subscription is already open.
      return;
    }

    const name = msg.name;
    let params = msg.params;
    // Attempt to parse string params, since a JSON array is required.
    if (_.isString(params)) {
      try {
        params = JSON.parse(params);
      } catch (err) {
        this.send({
          msg: 'error',
          reason: 'unable-to-parse-params',
          offendingMessage: msg,
        });
        return;
      }
    }

    if (!_.isArray(params)) {
      this.send({
        msg: 'error',
        reason: 'invalid-params',
        offendingMessage: msg,
      });
      return;
    }

    const handler = this.server._subscriptions[name];
    // If the publication doesn't exist, reply with `nosub`.
    if (!handler) {
      this.send({
        msg: 'nosub',
        id: msg.id,
        error: 'sub-not-found',
      });
      return;
    }

    // Create the subscription, register it and then start it.
    const subscription = new Subscription({
      session: this,
      handler,
      name,
      params,
      id: msg.id,
    });
    this._subscriptions[msg.id] = subscription;
    subscription.start();
  }

  /**
   * @typedef {UnsubMessage}
   * @property {String} msg The message type (`unsub`).
   * @property {String} id The subscription ID.
   */

  /**
   * Unsubscribes the client from the desired publication.
   * @param {UnsubMessage} msg The unsubscribe message.
   */
  unsubscribe(msg) {
    if (this._waitingForConnect) return;

    const sub = this._subscriptions[msg.id];
    if (!sub) {
      // No open subscription with the given name.
      this.send({
        msg: 'error',
        reason: 'no-such-subscription-to-unsub',
        offendingMessage: msg,
      });
      return;
    }

    sub.stop();
    delete this._subscriptions[msg.id];
  }

  /**
   * Processes the next message.
   */
  processMsg(msg) {
    // If we're not running, return. We can't throw an error as it's possible
    // that we:
    //   - received a new message and enqueued it
    //   - the connection dropped
    //   - we then tried to process the message
    if (!this.isRunning) {
      return;
    }

    // Find the correct handler if it exists.
    const handler = this.handlers[msg.msg];
    if (!handler) {
      this.send({
        msg: 'error',
        reason: 'unknown-msg-type',
        offendingMessage: msg,
      });
      return;
    }

    handler(msg);
  }

  /**
   * Stops the session. This includes (in the given order):
   *   - marking the session as no longer running
   *   - stopping all current subscriptions
   *   - closes the WebSocket
   */
  stop() {
    // Someone already called stop.
    if (!this.isRunning) return;
    this.isRunning = false;

    _.invoke(this._subscriptions, 'stop');

    this.spark.end();
  }

  /**
   * Attaches the event handles to the WebSocket.
   */
  attachEventHandlers() {
    this.spark.on('end', () => {
      this.stop();
    });

    this.spark.on('error', () => {
      this.stop();
    });

    this.spark.on('data', (data) => {
      if (!data.msg) {
        // If no msg type was sent, ignore it.
        this.send({
          msg: 'error',
          reason: 'must-provide-msg-type',
          offendingMessage: data,
        });
        return;
      }

      process.nextTick((msg) => {
        this.processMsg(msg);
      }, data);
    });
  }
}

module.exports = Session;
