'use strict';

import _ from 'underscore';
import EventEmitter from 'eventemitter3';

import LocalCollection from './LocalCollection';
import Primus from './Primus';
import Subscription from './Subscription';

/**
 * Returns the initial title case of the string, for example:
 *
 *  - initialTitleCase('hello') === 'Hello'
 *  - initialTitleCase('hello there') === 'Hello there'
 *
 * @param {String} str The string to modify.
 * @returns {String} The modified string.
 */
function initialTitleCase(str) {
  return str[0].toUpperCase() + str.slice(1);
}

/**
 * A PublicationClient handles subscribing to a publication provider and
 * managing the collections created by any publication that is subscribed to.
 */
class PublicationClient extends EventEmitter {
  /**
   * Creates a PublicationClient that connects to the publication provider at
   * the given url with the given options.
   *
   * @param {String} url The hostname of the publication provider as a URL.
   *    The provided protocol must be one of `https` or `http` (which
   *    correspond to the client using `wss` or `ws).
   * @param {Object} options Configuration options, these are passed through to
   *    Primus so see for all options, please see:
   *    https://github.com/primus/primus#connecting-from-the-browser.
   */
  constructor(url, options) {
    super();

    this._subscriptions = {};
    this._nextSubscriptionId = 0;
    this._collections = {};
    this._isConnected = false;

    this._client = new Primus(url, _.defaults(options, {
      strategy: ['online', 'disconnect']
    }));

    this._client.on('data', (message) => {
      this._handleMessage(message);
    });
    this._connect();

    // When we reconnect, we need to mark ourselves as not connected, and we
    // also need to re-subscribe to all of our publications.
    this._client.on('reconnected', () => {
      // Now that we're reconnected again, drop all local collections. We have
      // to do this because we don't know what updates we may have missed while
      // we've been disconnected (i.e. we could have missed `removed` events).
      // The reason that we drop the collections upon reconnection is that it
      // allows the local collections to be used/relied upon while we're
      // disconnected so that no consumers think we've suddenly dropped
      // everything the moment the connection drops. Also, instead of dropping
      // every collection, we use an private method to tell the collections to
      // drop all documents - this means pre-existing ReactiveQueries aren't
      // left dangling.
      _.invoke(this._collections, '_clear');

      this._connect();
      _.each(this._subscriptions, (sub) => {
        sub._start();
      });
    });

    // This event is purely a way for Primus to tell us that it's going to try
    // to reconnect.
    this._client.on('reconnect', () => {
      if (this._isConnected) this.emit('disconnected');
      this._isConnected = false;
    });
  }

  /**
   * Handles the given message if it is of a known message type.
   * @param {Object} msg The message that we received from the publication
   *    provider.
   */
  _handleMessage(msg) {
    if (!msg || !msg.msg) return;

    switch(msg.msg) {
    case 'added':
    case 'changed':
    case 'removed':
      this[`_on${initialTitleCase(msg.msg)}`](msg);
      break;
    case 'connected':
      this._isConnected = true;
      this.emit('connected');
      break;
    case 'ready':
      this.emit('ready', msg);
      break;
    default:
      this.emit(msg.msg, msg);
      break;
    }
  }

  /**
   * Returns a promise that will be resolved once the the publication provider
   * acknowledges to us that we are `connected`.
   *
   * @returns {Promise}
   */
  whenConnected() {
    return new Promise((resolve) => {
      if (this._isConnected) {
        resolve();
      } else {
        this.once('connected', resolve);
      }
    });
  }

  /**
   * Tells the publication provider that we would like to connect.
   */
  _connect() {
    this._client.write({
      msg:'connect',
      version: '1'
    });
  }

  /**
   * Returns the collection with the given name. If no such collection exists,
   * one is created and then returned.
   *
   * @param {String} name The name of the collection to return.
   * @returns {LocalCollection} The collection to return.
   */
  getCollection(name) {
    var collection = this._collections[name];
    if (!collection) {
      collection = this._collections[name] = new LocalCollection(name, this);
    }
    return collection;
  }

  /**
   * Subscribes us to the publication with the given name, any other parameters
   * are passed as arguments to the publication.
   *
   * @param {String} name The publication to subscribe to.
   * @param {*[]} params (optional) Params to pass to the publication.
   * @returns {Subscription} The subscription to the desired publication.
   */
  subscribe(name, ...params) {
    const id = this._nextSubscriptionId++;

    // Hash the name and params to cache the subscription.
    const subscriptionKey = JSON.stringify(_.toArray(arguments));
    var subscription = this._subscriptions[subscriptionKey];
    if (!subscription) {
      subscription = this._subscriptions[subscriptionKey] = new Subscription(
        String(id), name, params, this);
    }
    return subscription;
  }

  /**
   * Sends the given message to the publication provider.
   *
   * @param {Object} msg The message to send to the publication provider.
   */
  _send(msg) {
    this._client.write(msg);
  }

  /**
   * Removes the subscription from the current session. This is called
   * internally when a subscription is `stop()`ped.
   *
   * @param {String} subKey The subscription key that is unique to the
   *    subscription (generated from the name and parameters).
   */
  _removeSubscription(subKey) {
    delete this._subscriptions[subKey];
  }

  /**
   * Adds the document with the given ID and fields to the given collection
   * (all defined inside the message).
   *
   * @param {Object} message The message containing the document to add and the
   *    collection to add it to.
   */
  _onAdded(message) {
    var collectionName = message.collection;
    var id = message.id;
    var fields = message.fields;

    var collection = this.getCollection(collectionName);
    collection._onAdded(id, fields);
  }

  /**
   * Changes the document with the given ID in the given collection (all
   * defined inside the message).
   *
   * @param {Object} message The message containing the document to change and
   *    the collection that it exists inside of.
   */
  _onChanged(message) {
    var collectionName = message.collection;
    var id = message.id;
    var fields = message.fields;
    var cleared = message.cleared;

    var collection = this.getCollection(collectionName);
    collection._onChanged(id, fields, cleared);
  }

  /**
   * Removes the document with the given ID from the given collection (all
   * defined inside the message).
   *
   * @param {Object} message The message containing the document to remove and
   *    the collection to remove it from.
   */
  _onRemoved(message) {
    var collectionName = message.collection;
    var id = message.id;

    var collection = this.getCollection(collectionName);
    collection._onRemoved(id);
  }

  /**
   * Returns true if the client is currently connected to the server, false if
   * it is not.
   *
   * @returns {Boolean} Whether the client is connected to the server or not.
   */ 
  get isConnected() {
    return this._isConnected;
  }

  /**
   * Allows the user to close the connection.
   */
  stop() {
    this._client.end();
  }
}

export default PublicationClient;