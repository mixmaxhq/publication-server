'use strict';

const Dequeue = require('double-ended-queue');
const url = require('url');
const querystring = require('querystring');
const crypto = require('crypto');
const _ = require('underscore');
const uuid = require('node-uuid');

const Heartbeat = require('./heartbeat');
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
  constructor({server, spark} = {}) {
    this.server = server;
    this.spark = spark;
    this._openSubscriptions = {};

    // We expose these on child subscriptions, so we need to ensure
    // that they reference this parent session.
    this.send = this.send.bind(this);
    this.added = this.added.bind(this);
    this.changed = this.changed.bind(this);
    this.removed = this.removed.bind(this);
    this.handlers = {
      sub: this.subscribeWebSocket.bind(this),
      unsub: this.unsubscribeWebSocket.bind(this),
      connect: this.connect.bind(this),
      pong: this.pong.bind(this)
    };
    this.processMsg = this.processMsg.bind(this);

    // Set some state on the session.
    this._waitingForConnect = true;
    this.userId = spark.request.userId;
    this.isRunning = true;
    this.msgQueue = new Dequeue();
    this.attachEventHandlers();

    // Start the heartbeat.
    this._heartbeat = new Heartbeat({ session: this });
    this._heartbeat.start();
  }

  /**
   * Sends the given payload over the spark.
   * @param {Object} payload The payload to send over the spark.
   */
  send(payload) {
    this.spark.write(payload);
  }

  /**
   * @typedef {ConnectMessage}
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
        version: '1'
      });
      this.stop();
      return;
    }

    if (msg.session) {
      // TODO: log to the parent that this was an attempted reconnect.
      this._sessionId = msg.session;
    } else {
      this._sessionId = uuid.v4();
    }

    this._waitingForConnect = false;
    this.send({
        msg: 'connected',
        session: this._sessionId
    });
  }

  /**
   * Received a reply pong from the client.
   */
  pong() {
    this._heartbeat.reset();
  }

  /**
   * @typedef {SubMessage}
   * @property {String} msg The message type.
   * @property {String} id The subscription ID (assigned by the client).
   * @property {String} name The name of the publication to subscribe to.
   * @property {Array} params Params to be passed to the publication.
   */

  /**
   * Subscribes the client to the specified publication.
   * @param {SubMessage} msg The subscription message.
   */
  subscribeWebSocket(msg) {
    if (this._waitingForConnect) return;

    if (this._openSubscriptions[msg.id]) {
      // This session already has an open subscription for desired publication.
      return;
    }
    
    const name = msg.name;
    const params = msg.params;
    const handler = this.server._subscriptions[name];
    // If the publication doesn't exist, reply with `nosub`.
    if (!handler) {
      this.send({
        msg: 'nosub',
        id: msg.id
      });
      return;
    }

    // Create the subscription, register it and then start it.
    let subscription = new Subscription({
      session: this,
      handler,
      name,
      params,
      id: msg.id
    });
    this._openSubscriptions[msg.id] = subscription;
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
  unsubscribeWebSocket(msg) {
    if (this._waitingForConnect) return;

    let sub = this._openSubscriptions[msg.id];
    if (!sub) {
      // No open subscription with the given name.
      return;
    }

    sub.stop();
    delete this._openSubscriptions[msg.id];
  }

  /**
   * Processes the next message.
   */
  processMsg() {
    // If we're not running, return. We can't throw an error as it's possible
    // that we:
    //   - received a new message and enqueued it
    //   - the connection dropped
    //   - we then tried to process the message
    if (!this.isRunning) {
      return;
    }

    var msg = this.msgQueue && this.msgQueue.shift();
    if (!msg) {
      // Meteor treats this as an error, is it though?
      return;
    }

    // Find the correct handler, currently these can only be one of:
    //  - connect
    //  - sub
    //  - unsub
    let handler = this.handlers[msg.msg];
    if (!handler) {
      // DDP doesn't really have a generic way to return an error (i.e. for a
      // message with an unknown type), so let's just swallow the error.
      return;
    }

    this._heartbeat.reset();

    handler(msg);
  }

  /**
   * Sends an added message adding an object with the given `id` to the given
   * `collection`.
   *
   * @param {String} collection The collection that the document is being added
   *    to.
   * @param {String} id The ID of the document being added.
   * @param {Object} fields The fields that comprise the document being added.
   */
  added(collection, id, fields) {
    this.send({
      msg: 'added',
      collection,
      id,
      fields
    });
  }

  /**
   * Sends a changed message changing the object with the given `id` in the
   * given `collection`.
   *
   * @param {String} collection The collection that the document that is being
   *    changed is a member of.
   * @param {String} id The ID of the document being changed.
   * @param {Object} fields The fields that have been changed.
   */
  changed(collection, id, fields) {
    this.send({
      msg: 'changed',
      collection,
      id,
      fields
    });
  }

  /**
   * Sends a removed message removing the object with the given `id` from the
   * given `collection`.
   *
   * @param {String} collection The collection that the document is being
   *    removed from.
   * @param {String} id The ID of the document being removed.
   */
  removed() {
    this.send({
      msg: 'removed',
      collection,
      id
    });
  }

  /**
   * Stops the session. This includes (in the given order):
   *   - marking the session as no longer running
   *   - stopping all current subscriptions
   *   - stops the heartbeat
   *   - closes the WebSocket
   */
  stop() {
    // Someone already called stop.
    if (!this.isRunning) return;
    this.isRunning = false;

    _.invoke(this._openSubscriptions, 'stop');

    this._heartbeat.stop();
    this.spark.end();
  }

  /**
   * Attaches the event handles to the WebSocket.
   */
  attachEventHandlers() {
    let self = this,
        spark = this.spark;
    spark.on('end', () => {
      self.stop();
    });

    spark.on('error', (err) => {
      self.stop();
    });

    spark.on('data', (data) => {
      try {
        if (!data.msg) {
          // If no msg type was sent, ignore it.
          return;
        }

        // TODO: should this only done once we send the `connected` message?
        // Safety belts for the race condition, where a bad client sends a
        // message before we tell them that we're connected.
        if (self._heartbeat) process.nextTick(self._heartbeat.reset);

        self.msgQueue.push(data);
        process.nextTick(self.processMsg);
      } catch (err) {
        // Log this error?
      }
    });
  }

  /**
   * Used by the heartbeat to stop the session if the connection is dead (the
   * client isn't responding in a timely manner).
   */
  connectionIsDead() {
    this.stop();
  }
}


module.exports = Session;