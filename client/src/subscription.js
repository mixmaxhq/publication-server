'use strict';

import _ from 'underscore';
import EventEmitter from 'eventemitter3';

/**
 * A Subscription encapsulates the logic of subscribing to server side
 * publications and letting any callers know when the subscription to that
 * publication is `ready` (has returned its initial state).
 *
 */
class Subscription extends EventEmitter {
  /**
   * Creates a new subscription with the given ID to the publication
   * defined my the given name and provided the given parameters.
   *
   * @param {String} id The ID for the subscription. This is arbitrary and has
   *    no meaning as far as the publication is concerned, it exists purely for
   *    the client to be able to uniquely identify the subscription.
   * @param {String} name The name of the publication to subscribe to.
   * @param {*[]} params (optional) Parameters to provide to the publication.
   * @param {Object} conn The connection to the publication provider.
   */
  constructor(id, name, params, conn) {
    super();

    this._id = id;
    this._connection = conn;
    this._name = name;
    this._params = params;
    this._isReady = false;
    this._isFailed = false;

    this._boundOnReady = this._onReady.bind(this);
    this._boundOnNoSub = this._onNoSub.bind(this);
    this._start();
  }

  /**
   * Starts a subscription (sends the initial `sub` message) only once the
   * connection is ready.
   */
  _start() {
    if (this._connection._isConnected) {
      this._sendSubMsg();
    } else {
      this._connection.once('connected', () => {
        this._sendSubMsg();
      });
    }
  }

  /**
   * Sends the `sub` message to the publication-server and begins listening
   * for the publication-server to tell us that our subscription is `ready`.
   */
  _sendSubMsg() {
    this._connection._send({
      msg: 'sub',
      id: this._id,
      name: this._name,
      params: this._params
    });
    this._connection.on('ready', this._boundOnReady);
    this._connection.on('nosub', this._boundOnNoSub);
  }

  /**
   * Stops the subscription by unsubscribing from the publication provider.
   */
  stop() {
    this._connection._send({
      msg: 'unsub',
      id: this._id
    });
    this._connection._removeSubscription(
      JSON.stringify([this._name].concat(this._params)));
  }

  /**
   * Returns a promise that resolves when the publication has indicated that it
   * has finished sending its initial state and is `ready`.
   *
   * @returns {Promise} A promise indicating whether the subscription is ready
   *    to be used.
   */
  whenReady() {
    return new Promise((resolve, reject) => {
      if (this._isFailed) {
        reject();
      } else if (this._isReady) {
        resolve();
      } else {
        this.once('ready', () => {
          this.removeListener('nosub');
          resolve();
        });
        this.once('nosub', () => {
          this.removeListener('ready');
          reject();
        });
      }
    });
  }

  /**
   * Marks the subscription as ready and removes the `ready` message listener.
   * @param {Object} msg A message from the publication provider.
   */
  _onReady(msg) {
    const readySubs = msg.subs;
    if (_.contains(readySubs, this._id)) {
      this._isReady = true;
      this.emit('ready');
      this._connection.removeListener('ready', this._boundOnReady);
      this._connection.removeListener('nosub', this._boundOnNoSub);
    }
  }

  /**
   * Marks the subscription as non-existent and removes any local listeners.
   *
   * @param {Object} msg A message from the publication provider.
   */
  _onNoSub(msg) {
    if (msg.id !== this._id) return;

    this._isFailed = true;
    this.emit('nosub');
    this._connection.removeListener('ready', this._boundOnReady);
    this._connection.removeListener('nosub', this._boundOnNoSub);
  }
}

export default Subscription;