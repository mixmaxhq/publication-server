'use struct';

import _ from 'underscore';
import EventEmitter from 'eventemitter3';

import ReactiveQuery from './reactiveQuery';

/**
 * A LocalCollection is a collection of documents held in the browser. It
 * emits events when documents are added, changed or removed - making it useful
 * as a source of reactivity for client side consumers.
 */
class LocalCollection extends EventEmitter {
  /**
   * Constructs a new LocalCollection.
   */
  constructor() {
    super();
    this._docs = {};
  }

  /**
   * Adds the document with the given ID and the given fields to the
   * collection, and then emits an `added` event.
   *
   * @param {String} id The ID of the document to add.
   * @param {Object} fields The fields defining the document (excluding the
   *    ID).
   */
  _onAdded(id, fields) {
    var doc = this._docs[id] = _.extend({}, fields, {
      _id: id
    });

    this.emit('added', doc);
  }

  /**
   * Changes the document with the given ID to be updated to have the provided
   * fields and to no longer have the cleared fiels. If there is no document
   * with the given ID, an error is thrown, otherwise a `changed` event is
   * emitted.
   *
   * @param {String} id The ID of the document to change.
   * @param {Object} fields The fields to update (to set) on the document.
   * @param {String[]} cleared The fields to remove from the document.
   */
  _onChanged(id, fields, cleared) {
    var doc = this._docs[id];
    if (!doc) {
      throw new Error('Document has been changed without having been added!');
    }

    var expandedFields = _.expandKeys(fields);
    doc = this._docs[id] = _.chain(doc).deepExtend(expandedFields).omit(cleared).value();

    var changeset = _.clone(expandedFields);

    if (!_.isEmpty(cleared)) {
      // Perform an expansion and deep merge of cleared, if it exists.
      var clearedObj = _.chain(cleared)
        .object(_.times(cleared.length, _.constant(undefined)))
        .expandKeys()
        .value();
      // Note that the changeset might be empty because `fields` wasn't set.
      changeset = _.deepExtend(changeset || {}, clearedObj);
    }
    this.emit('changed', doc, changeset);
  }

  /**
   * Removes the document with the given ID from the collection. If there is no
   * document with the given ID, an error is thrown, otherwise a `removed`
   * event is emitted.
   *
   * @param {String} id The ID of the document to remove.
   */
  _onRemoved(id) {
    var doc = this._docs[id];
    if (!doc) {
      throw new Error('Document has been removed without having been added!');
    }
    delete this._docs[id];

    this.emit('removed', doc);
  }

  /**
   * Returns a ReactiveQuery that points to this LocalCollection and matches
   * documents against the given selector.
   *
   * @param {Object} selector The selector against which to match the records
   *    in the collection.
   * @return {ReactiveQuery} A new reactive query.
   */
  find(selector) {
    return new ReactiveQuery(this, selector);
  }

  /**
   * Returns all the documents in the collection.
   *
   * @returns {Object[]} All the documents in the collection.
   */
  toArray() {
    return _.values(this._docs);
  }

}

export default LocalCollection;