## Release History

* 2.0.0 *Breaking* Upgrade primus to 7.3.3. This changes the `ping` and `pong` attributes when passing options to the primus client to one `pingTimeout` option.

* 1.4.11 Allow stopping a subscription before its 'ready' event is received

* 1.4.10 Fix README, correct for accidental 1.4.9 publish

* 1.4.9 deyarn

* 1.4.8 Add ES6 `Promise` polyfill

* 1.4.7 Use `lodash.cloneDeep` to ensure that we don't emit direct object references during event emission.

* 1.4.6 Prevent `Subscription#whenReady` from resolving prematurely after the websocket connects; implement `PublicationClient#whenConnected`

See [the server changelog](https://github.com/mixmaxhq/publication-server/blob/master/README.md#server-changelog) for releases pre-1.4.6.
