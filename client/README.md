publication-client
=====

This module provides a client side module for subscribing to publications from
a [publication-server](https://github.com/mixmaxhq/publication-server).

## Installation
```
$ npm install publication-client
```

## Usage

### Requirements

`publication-client` is an ES6 module, so you most likely want to use a bundler
such as [rollup](https://github.com/rollup/rollup). It also depends on
`underscore`, so make sure that the project using `publication-client` can
resolve `underscore`, this normally means either:
  - `npm install`ing the module and using [rollup-plugin-node-resolve](https://github.com/rollup/rollup-plugin-node-resolve)
  - if you already have underscore somewhere else locally in your build, you
    can make an alias to is using [rollup-plugin-alias](https://github.com/frostney/rollup-plugin-alias)

### Initialization

The only required field for creating a client is the host to connect to as a
URL. This means that if you have the publication server mounted at
`wss://sub.domain.tld/websocket` we would provide `https://sub.domain.tld` as
the URL param. Also note that you can provide query params to be passed as
part of the provided connect URL (i.e. `https://sub.domain.tld?foo=bar`).

```js
import PublicationClient from 'publication-client';

var client = new PublicationClient(`https://testing.domain.com?foo=bar`);
```

#### Checking connection state

The publication client emits a `connected` event once it has successfully
connected.

```js
client.once('connected', () => {
  console.log('connected successfully!');
});
```

It also emits `disconnected` event as soon as it becomes disconnected, and
will emit a `connected` event if it is able to successfully connect to the
publication server again.
```js
client.on('disconnected', () => {
  console.log('Oh no! Our connection is gone!');

  client.once('connected', () => {
    console.log('Phew! We have a new connection again!');
  });
});
```

### Subscribing

To subscribe to a publication, simply provide the publication name and any
parameters for it. The subscription will not begin until the connection has
been successfully connected.

```js
client.subscribe('hello', {
  actor: 'world'
});
```

Subscriptions also can be queried for 'readiness'. They can return a Promise
via the `whenReady` function, and also emit a `ready` event.

```js
client.subscribe('foo').whenReady().then(() => {
  console.log('subscription is ready!');
});
```

Likewise, if a subscription fails during initialization, the Promise returned
from `whenReady` will reject with the responsible error and a `nosub` event
will also be emitted.

```js
client.subscribe('noSuchSub').whenReady().catch((err) => {
  console.log(`Subscription failed with err: ${err.message}`);
});
```

#### Waiting on initial subscriptions to load
`whenReady` is provided as a convenience function if you want to be able to
wait for a single subscription or for multiple subscriptions to complete
before performing some action. For example:

```js
var sub0 = client.subscribe('sub0'),
    sub1 = client.subscribe('sub1'),
    sub2 = client.subscribe('sub2');
Promise.all(_.invoke([sub0, sub1, sub2], 'whenReady')).then(() => {
  console.log('Our initial subscriptions are all ready!');
});
```

#### Subscription "readiness" after disconnection
When the client reconnects to the server after being disconnected, the
subscription will reset - meaning that `whenReady` can be queried once again
to know when the subscription is ready.

The reason we do this is to allow a consumer to know about the updated state of
a subscription after a connection has been broken/down for a long period of
time (i.e. a user closed their laptop and re-opened it later). This is
necessary because if a connection is down for a significant period of time, we
could have missed a very large number of additions, changes and removals to any
local collections that our subscription populates. As such, all local
collections are cleared of any documents upon reconnection (so that we can
ensure that they are then updated with the appropriate state). Another benefit
of this approach is that any pre-exising reactive queries on local collection
do not need to be re-created, they will still function as desired.

Note that similarly to how a subscription emits `ready` when it is ready, after
the client has been disconnected and a subscription is ready after
re-subscription, it will again emit a `ready` event.

#### Subscription errors after initialization
After a subscription has been initialized, errors may still occur server side.
The subscription may be listened to in order to receive these events which are
emitted as `nosub` events (the naming comes from Meteor which this publication
system is based off of, [see this documentation for more detail][meteor-ddp]).

```js
let helloSub = client.subscribe('hello');

helloSub.on('nosub', (err) => {
  console.log(`the subscription experienced an error: ${err.message}`);
});
```

### Querying collections

The publication client also manages all collections created by the subscribed
publications. Retrieving a collection is as simple as:

```js
var collection = client.getCollection('baz');
```

We can then `find` documents of interest and listen for changes that we're
interested in. To find documents and retrieve them:

```js
var docs = client.getCollection('baz').find({
  _id: 'hello'
}).fetch();
```

Note that currently find only supports direct matching (as in the example
above) and the [$elemMatch](https://docs.mongodb.com/manual/reference/operator/query/elemMatch/) operator for matchin objects inside of arrays.

To listen for changes that match a provided query:

```js
client.getCollection('baz').find({
  _id: 'foo'
}).on('added', (id, fields) => {
  // `fields` contains all fields of the document excluding the `_id` field.
  console.log(`added a new document: ${Object.assign({}, {id}, fields)}`);
}).on('changed', (id, changes) => {
  // `changes` contains the changed fields with their new values.
  // If a field was removed from the document then it will be present in `changes`
  // with a value of `undefined`.
  console.log(`document with id ${id} has changes: ${changes}`);
}).on('removed', (id) => {
  console.log(`removed document with id: ${id}`);
});
```

Note that the handlers for these events are the same as those for
[Meteor's Mongo.Cursor.observeChanges](https://docs.meteor.com/api/collections.html#Mongo-Cursor-observeChanges) (specifically the added, changed and removed events).

### Closing the connection
If for whatever need, you need to close the publication connection, simply use
the `stop()` method. Note that once you do this you, you'll need to recreate an
entirely new publication-client to reconnect.

```js
client.stop();
```

### Client changelog

See [the server changelog](https://github.com/mixmaxhq/publication-server/blob/master/README.md#server-changelog) for releases pre-1.4.6.

* 1.4.8 Add ES6 `Promise` polyfill
* 1.4.7 Use `lodash.cloneDeep` to ensure that we don't emit direct object references during event emission.
* 1.4.6 Prevent `Subscription#whenReady` from resolving prematurely after the websocket connects; implement `PublicationClient#whenConnected`

[meteor-ddp]: https://github.com/meteor/meteor/blob/devel/packages/ddp/DDP.md
