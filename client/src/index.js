'use strict';

import Primus from './primus';
import _ from 'underscore';
import $ from 'jquery';
import EventEmitter from 'eventemitter3';

import LocalCollection from './localCollection';
import Subscription from './subscription';

const Deferred = $.Deferred;

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
   * @param {Object} options Configuration options.
   */
  constructor(url, options) {
    super();

    this._subscriptions = {};
    this._nextSubscriptionId = 0;
    this._collections = {};

    this._whenConnected = new Deferred();
    
    this._client = new Primus(url, options || {
      strategy: 'offline,disconnected'
    });

    this._client.on('data', (message) => {
      this._handleMessage(message);
    });
    this._connect();

    this._client.on('reconnected', () => {
      this._whenConnected = new Deferred();
      this._connect();
      _.each(_.values(this._subscriptions), (sub) => {
        sub._start();
      });
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
      this._whenConnected.resolve();
      break;
    case 'ready':
      this.emit('ready', msg);
      break;
    }
  }

  /**
   * Returns a promise that will be resolved once the the publicated provider
   * acknowledges to us that we are `connected`.
   *
   * @returns {Promise}
   */
  whenConnected() {
    return this._whenConnected;
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
   * @returns {Subscription} The subscription to the desired publication.
   */
  subscribe(name) {
    const params = _.rest(arguments);
    const id = this._nextSubscriptionId++;

    // Hash the name and params to cache the subscription.
    const subscriptionKey = JSON.stringify(_.toArray(arguments));
    var subscription = this._subscriptions[subscriptionKey];
    if (!subscription) {
      subscription = this._subscriptions[subscriptionKey] = new Subscription(
        id + '', name, params, this);
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
}

export default PublicationClient;