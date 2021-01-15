## Release History

* 2.1.0 Add in some primus 8 enhancements, this requires usage of publication-client@>v2.

* 2.0.0 Update primus to 8.0.1. You must now install your own transformer packages.

* 1.9.2 Fix botched 1.9.1 publish to include primus and uws downgrades

*  Fix breaking change in ping/pong messages

* 1.9.0 Add `transformer` option to primus initialization defaulting to `uws`

* 1.8.1 Disable pingInterval that's handled by the server

* 1.8.0 Fix unpinned `uws` version

* 1.7.0 Upgrades to primus 7.3.3 and uws 10.148.1 for node 10 support

* 1.6.4 Add name property when applying subscription handler functions

* 1.6.3 Update client version

* 1.6.2 Fix erroneous publish

* 1.6.1 Allow stopping a subscription before its 'ready' event is received

* 1.6.0 Pin the uws version.

* 1.5.1 Prevent `Subscription#whenReady` from resolving prematurely after the websocket connects; implement `PublicationClient#whenConnected`

* 1.5.0 Use Yarn; fix `uws` dependency after previous versions were unpublished.

* 1.4.4 Remove message field from nosub message.

* 1.4.1 Handle subscription initialization errors.

* 1.4.0 Handle custom event broadcasting (for shutdown message specifically).

* 1.3.0 All shutdown options passed through to Primus.

* 1.1.1 Fix bad ObjectUtils reference.

* 1.1.0 Alter how we wrap the authentication function and make it required.

* 1.0.0 Initial release
