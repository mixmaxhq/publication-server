'use strict';

import _ from 'underscore';

/**
 * isMatch evaluates whether the give doc matches the given selector.
 * Copied from _.isMatch: https://github.com/jashkenas/underscore/blob/master/underscore.js#L1144
 * and modified to support `$elemMatch`.
 * @param  {[type]} doc      [description]
 * @param  {[type]} selector [description]
 * @return {[type]}          [description]
 */
function isMatch(doc, selector) {
  var keys = _.keys(selector);
  var length = keys.length;
  if (doc === null) return !length;
  var obj = Object(doc);
  for (var i = 0; i < length; i++) {
    var key = keys[i];
    // If the value (selector[key]) is an Object and the corresponding value
    // in the doc is an array, we might be looking at a usage of $elemMatch.
    // So check if the only key in selector[key] is `$elemMatch` and then
    // recursively check the selector passed to `$elemMatch` against each
    // value in the corresponding array in the target object. If a single one
    // matches, continue on with the query matching/checking.
    if (_.isObject(selector[key]) && _.isArray(obj[key])) {
      var objKeys = _.keys(selector[key]);
      if (objKeys.length === 1 && objKeys[0] === '$elemMatch') {
        var arrayVals = obj[key];
        var elemMatchQuery = selector[key].$elemMatch;
        var foundMatch = false;
        for (var j = 0; j < arrayVals.length; j++) {
          if (isMatch(arrayVals[j], elemMatchQuery)) {
            foundMatch = true;
            break;
          }
        }
        if (!foundMatch) return false;
        // We found a match, so continue on.
        continue;
      }
    }
    if (selector[key] !== obj[key] || !(key in obj)) return false;
  }
  return true;
}

/**
 * Expands any keys with dot notation in an object.
 * Returns the original object if there aren't any flattened keys to begin with.
 *
 * @param  {Object} object
 * @return {Object} object with keys as nested objects
 */
function expandKeys(object) {
  var hasFlattenedKeys = _.some(object, function(val, key) {
    return key.split('.').length > 1;
  });
  if (!hasFlattenedKeys) return object;

  return _.reduce(object, function(payload, value, key) {
    var path = key.split('.');
    if (path.length === 1) {
      var obj = {};
      obj[key] = value;
      payload = deepExtend(payload, obj);
      return payload;
    }
    var subKey = path.pop();
    var localObj = payload;
    while (path.length) {
      var subPath = path.shift();
      localObj = localObj[subPath] = localObj[subPath] || {};
    }
    localObj[subKey] = object[key];
    return payload;
  }, {});
}

/**
 * Performs a deep merge of two objects, source into target.
 *
 * @param  {Object} target
 * @param  {Object} source
 * @return {Object}
 */
function deepExtend(target, source) {
  _.each(source, function(value, key) {
    if (_.has(target, key) && isObject(target[key]) && isObject(source[key])) {
      deepExtend(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  });
  return target;
}

/**
 * isObject is a cheap version of $.isPlainObject because importing jquery for
 * a single function is overkill. The only difference in functionality is that
 * this `isObject` fails to return false for an ES6 class created object (which
 * is fine for our current needs).
 *
 * @param {*} obj Anything.
 * @returns {Boolean} true if `obj` is a plain object or ES6 class instantiated
 *    object, false otherwise.
 */
function isObject(obj) {
  return _.isObject(obj) && !_.isArray(obj);
}

export {
  deepExtend,
  expandKeys,
  isMatch
};