'use strict';

/**
 * Deferred is a wrapper to similar to jquery's Deferred class that uses
 * native promises instead of jquery's.
 */
class Deferred {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export default Deferred;