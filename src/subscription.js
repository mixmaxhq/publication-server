'use strict';

const _ = require('underscore');

const PUBLIC_API = ['userId', 'added', 'changed', 'removed'];

/**
 * Represents a subscription to a publication for a Session.
 */
class Subscription {
  /**
   * Creates a new subscription to the given publication for the given Session.
   *
   * @param {Object} session The session this subscriptions is for.
   * @param {String} name The name of the publication.
   * @param {Function} handler The publication.
   * @param {Array} params The params to pass to the publication.
   * @param {String} id The ID that the client has registered for this
   *    Subscription.
   */
  constructor({session, name, handler, params, id} = {}) {
    _.extend(this, _.pick(session, PUBLIC_API));
    this._name = name;
    this._session = session;
    this._handler = handler;
    this._params = params;
    this._id = id;
    this.onStop = this.onStop.bind(this);
    this.ready = this.ready.bind(this);
    this._isReady = false;

    this._stopCallbacks = [];
  }

  /**
   * Starts the publication. Currently, it spawns it inside of a fiber.
   */
  start() {
    this._handler.apply(_.pick(this, PUBLIC_API.concat(['onStop', 'ready'])), this._params);
  }

  /**
   * Marks the subscription as `ready`. This is safe to call multiple times, it
   * will only send the `ready` message on the first call.
   */
  ready() {
    // We already called ready.
    if (this._isReady) return;

    this._isReady = true;
    this._session.send({
      msg: 'ready',
      subs: [this._id]
    });
  }

  /**
   * Registers the given fn to run when we stop this subscription.
   * @param {Function} fn The function to add to the registered callbacks to
   *    run when the subscription is stopped.
   */
  onStop(fn) {
    this._stopCallbacks.push(fn);
  }

  /**
   * Stops the subcription, calling all registered `onStop` functions.
   * Currently, it runs them all sequentially.
   */
  stop() {
    _.each(this._stopCallbacks, (fn) => fn());
  }
}


module.exports = Subscription;