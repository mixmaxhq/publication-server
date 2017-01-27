
/**
 * A publication error wraps the original error while also providing us with
 * any extra context (`userId` or otherwise).
 */
class PublicationError {
  constructor(err, meta) {
    this.err = err;
    this.meta = meta;
  }

  get error() {
    return this.err;
  }

  get userId() {
    return this.meta.userId;
  }

  get extra() {
    return this.meta.extra;
  }
}

module.exports = PublicationError;