
/**
 * A publication error wraps the original error while also providing us with
 * any extra context (`userId` or otherwise).
 */
class PublicationError {
  /**
   * Creates a new PublicationError with the given original error and
   * given metadata.
   */
  constructor(err, meta) {
    this.err = err;
    this.meta = meta;
  }

  /**
   * Returns the original error.
   */
  get error() {
    return this.err;
  }

  /**
   * Returns the userId.
   */
  get userId() {
    return this.meta.userId;
  }

  /**
   * Returns any other extra information.
   */
  get extra() {
    return this.meta.extra;
  }
}

module.exports = PublicationError;