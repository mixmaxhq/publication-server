'use strict';

import _ from 'underscore';
import EventEmitter from 'eventemitter3';
import { isMatch } from './utils';


/**
 * Creates a reactive query which will emit 'added', 'changed', and 'removed'
 * events with the same semantics as Meteor's
 * `Mongo.Cursor.prototype.observeChanges` callbacks.
 */
class ReactiveQuery extends EventEmitter {
  /**
   * Constructs the ReactiveQuery and sets up event listeners on the
   * given local collection.
   *
   * @param {LocalCollection} collection The collection to observe.
   * @param {Object} selector The selector against which to match the records
   *    in the collection.
   */
  constructor(collection, selector) {
    super();
    this._collection = collection;
    this._selector = selector;

    /**
     * Emits an added event if a document that was added to the LocalCollection
     * that is this ReactiveQuery's source is a match for the query's filter.
     *
     * @param {Object} doc The added document.
     */
    this._collection.on('added', (doc) => {
      if (isMatch(doc, this._selector)) {
        // _fields_ should have all fields of the document excluding the `_id` field.
        this.emit('added', doc._id, _.omit(doc, '_id'));
      }
    });

    /**
     * Emits a changed event if a document that was changed in the LocalCollection
     * that is this ReactiveQuery's source is a match for the query's filter.
     *
     * @param {Object} doc The changed document.
     * @param {Object} changeset The changed fields.
     */
    this._collection.on('changed', (doc, changeset) => {
      if (isMatch(doc, this._selector)) {
        this.emit('changed', doc._id, changeset);
      }
    });

    /**
     * Emits a removed event if a document that was removed from the
     * LocalCollection that is this ReactiveQuery's source is a match for the
     * query's filter.
     *
     * @param {Object} doc The removed document.
     */
    this._collection.on('removed', (doc) => {
      if (isMatch(doc, this._selector)) {
        this.emit('removed', doc._id);
      }
    });
  }

  /**
   * Fetches all documens from the source LocalCollection that match the
   * query selector.
   *
   * @returns {Object[]} An array of all documents that match the selector.
   */
  fetch() {
    return _.filter(this._collection.toArray(), (doc) => {
      return isMatch(doc, this._selector);
    });
  }
}

export default ReactiveQuery;