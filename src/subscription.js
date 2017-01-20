'use strict';

const _ = require('underscore');

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
    this._session = session;
    this._name = name;
    this._handler = handler;
    this._params = params;
    this._id = id;
    this._isReady = false;

    this._stopCallbacks = [];
  }

  /**
   * Starts the publication.
   */
  start() {
    this._handler.apply({
      userId: this._session.userId,

      /**
       * Sends an added message adding an object with the given `id` to the given
       * `collection`.
       *
       * @param {String} collection The collection that the document is being added
       *    to.
       * @param {String} id The ID of the document being added.
       * @param {Object} fields The fields that comprise the document being added.
       */
      added: (collection, id, fields) => {
        this._session.send({
          msg: 'added',
          collection,
          id,
          fields
        });
      },

      /**
       * Sends a changed message changing the object with the given `id` in the
       * given `collection`.
       *
       * @param {String} collection The collection that the document that is being
       *    changed is a member of.
       * @param {String} id The ID of the document being changed.
       * @param {Object} fields The fields that have been changed.
       */
      changed: (collection, id, fields) => {
        this._session.send({
          msg: 'changed',
          collection,
          id,
          fields
        });
      },

      /**
       * Sends a removed message removing the object with the given `id` from the
       * given `collection`.
       *
       * @param {String} collection The collection that the document is being
       *    removed from.
       * @param {String} id The ID of the document being removed.
       */
      removed(collection, id) {
        this._session.send({
          msg: 'removed',
          collection,
          id
        });
      },
      onStop: this.onStop.bind(this),
      ready: this.ready.bind(this)
    }, this._params);
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