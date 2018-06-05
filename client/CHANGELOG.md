## Release History

* 1.4.9 deyarn

* 1.4.8 Add ES6 `Promise` polyfill

* 1.4.7 Use `lodash.cloneDeep` to ensure that we don't emit direct object references during event emission.

* 1.4.6 Prevent `Subscription#whenReady` from resolving prematurely after the websocket connects; implement `PublicationClient#whenConnected`

See [the server changelog](https://github.com/mixmaxhq/publication-server/blob/master/README.md#server-changelog) for releases pre-1.4.6.
