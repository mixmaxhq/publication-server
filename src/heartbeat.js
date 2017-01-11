'use strict';

/**
 * Handles heartbeating logic for a Session.
 */
class Heartbeat {
  /**
   * Creates the heartbeat for the given session.
   * @param {Object} session THe session to maintain the heartbeat for.
   */
  constructor({session} = {}) {
    this._session = session;
  }

  /**
   * Starts the heartbeat.
   */
  start() {
    this._enqueuePing();
  }

  /**
   * Stops the heartbeat.
   */
  stop() {
    clearTimeout(this._waitingPing);
    clearTimeout(this._waitingForPing);
  }

  /**
   * Resets the timeouts. This is called when any message is received by the
   * Session.
   */
  reset() {
    this._enqueuePing();
  }

  /**
   * This function sets a timeout to send the next ping to th client at. Once
   * that ping has been sent, it sets a timeout within which we must receive
   * the responding pong, or we'll kill the connection.
   */
  _enqueuePing() {
    const self = this;
    clearTimeout(this._waitingPing);
    clearTimeout(this._waitingForPing);
    this._waitingPing = setTimeout(() => {
      self._session.send({
        msg: 'ping'
      });
      self._waitingForPong = setTimeout(() => {
        self._session.connectionIsDead();
      }, 5000); // Five seconds for the client to reply to the ping.
    }, 30000); // Thirty seconds since the last message.
  }
}


module.exports = Heartbeat;