publication-client
=====

This module provides a client side module for subscribing to publications from
a [publication-server](https://github.com/mixmaxhq/publication-server).

## Installation
```
$ npm install --save @mixmaxhq/publication-client
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

The publication client exposes a promise that can be used to know when a client
has successfully connected.

```js
client.whenConnected().then(() => {
  console.log('connected successfully!');
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

Subscriptions also can be queried for 'readiness':

```js
client.subscribe('foo').whenReady().then(() => {
  console.log('subscription is ready!');
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
}).on('added', (doc) => {
  console.log(`added a new document: ${doc}`);
}).on('changed', (doc, changes) => {
  console.log(`document with id ${doc._id} has changes: ${changes}`);
}).on('removed', (id) => {
  console.log(`removed document with id: ${id}`);
});
```

Note that the handlers for these events are the same as those for
[Meteor's Mongo.Cursor.observeChanges](https://docs.meteor.com/api/collections.html#Mongo-Cursor-observeChanges) (specifically the added, changed and removed events).
