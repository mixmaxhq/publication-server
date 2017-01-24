'use strict';

import _ from 'underscore';
import $ from 'jquery';

const Deferred = $.Deferred;

/**
 * A Subscription encapsulates the logic of subscribing to server side
 * publications and letting any callers know when the subscription to that
 * publication is `ready` (has returned its initial state).
 *
 */
class Subscription {
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
    this._id = id;
    this._connection = conn;
    this._readyDeferred = new Deferred();

    this._name = name;
    this._params = params;

    this._boundOnReady = this._onReady.bind(this);
    this._start();
  }

  /**
   * Starts a subscription (sends the initial `sub` message) only once the
   * connection is ready.
   */
  _start() {
    this._connection.whenConnected().then(() => {
      this._connection._send({
        msg: 'sub',
        id: this._id,
        name: this._name,
        params: this._params
      });

      this._connection.on('ready', this._boundOnReady);
    });
  }

  /**
   * Stops the subscription by unsubscribing from the publication provider.
   */
  stop() {
    this._connection._send({
      msg: 'unsub',
      id: id
    });
  }

  /**
   * Returns a promise that resolves when the publication has indicated that it
   * has finished sending its initial state and is `ready`.
   *
   * @returns {Promise} A promise indicating whether the subscription is ready
   *    to be used.
   */
  whenReady() {
    return this._readyDeferred;
  }

  /**
   * Marks the subscription as ready and removes the `ready` message listener.
   * @param {Object} msg A message from the publication provider.
   */
  _onReady(msg) {
    const readySubs = msg.subs;
    if (_.contains(readySubs, this._id)) {
      this._readyDeferred.resolve();
      this._connection.removeListener('ready', this._boundOnReady);
    }
  }
}

export default Subscription;