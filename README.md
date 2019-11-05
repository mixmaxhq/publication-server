publication-server
=====

### Usage
In order to be able to mount a WebSocket server on the same port as an
Express server, we need to get the http server from the app so that we can
expose it to the WebSocket server. As an example:

```js
var express = require('express');
var PublicationServer = require('publication-server');

var app = express();
var server = require('http').createServer(app);
var errHandler = function(err) {
  console.log(err.error);
};

var pubServer = new PublicationServer({
  authFn: authenticationFunction,
  mountPath: '/ws',
  server,
  errHandler
});

// ...

server.listen(process.env.PORT || '8080');
```


#### Authentication function

One plus of this server is that it can authenticate WebSocket requests via the
headers on the initial `UPGRADE` request. This is done in the *REQUIRED*
authentication function that is passed to the `publication-server` constructor.
This authentication function takes two parameters which are the originating HTTP
`UPGRADE` request and a callback. The callback has the following signature:

```js
/**
 * This callback is called to signal that we've either authenticated the
 * incoming HTTP UPGRADE request or we've rejected it.
 *
 * @param {Error} err The error that we've returned to signify why the user
 *    failed authentication. If `err` is null we've successfully authenticated
 *    the incoming connection to upgrade into a WebSocket.
 * @param {String} userId An optional unique tag to identify a user by. It is
 *    exposed inside of publications at `this.userId`. Some publications may
 *    not require this value, which is why it is optional to return, although
 *    it is highly encouraged to return a `userId` to be set.
 */
function done (err, userId) {}
```

The authorization function would have the following flow then:

```js
function authenticationFunction(req, done) {
  // Logic checking the websocket headers, etc.
  // ...

  // If the request failed authentication, return an error.
  if (failedAuth) process.nextTick(done, new Error('failed to authenticate user'));

  // If the request passed authentication, call the callback with the the ID
  // of the user that we've authenticated.
  process.nextTick(done, null, `SUPERUSER$12345`);
}
```

#### Registering publications

```js
var pubSub = require('./path/to/initialized/server');

pubSub.publish('PublicationName', function() {

});
```

#### Marking a publication as `ready`
Whenever a publication has finished publishing the initial documents that it
needs to send, it must mark itself as `ready`. This is accomplished by calling
`this.ready()`.

```js
pubSub.publish('PublicationName', function() {

  // Initial document publishing.
  this.ready();

  // Add future event handlers if desired.
});
```

#### Errors inside a publication
If a publication encounters an error, it should pass the error to `this.error()`.
This will call the registered error handler, and pass the error along to the client.

```js
pubSub.publish('PublicationName', function() {
  this.error(new Error('failed to do something require'));
});
```


#### Error handling
Errors passed to the error handler provided upon server initialization are
objects with these properties:

 - `error`: The original error that was reported by the publication.
 - `userId`: The ID of the user who was subscribing to the publication when the
   error occurred
 - `extra`: Any extra information that was recorded - currently this is the
   parameters that were provided to the publication.

### Gracefully shutting down
The publication server also exposes a `shutdown` function which accepts an
optional timeout, within which it is expected to close all current websocket
connections. The timeout within which to gracefully shutdown defaults to zero
if none is provided. Also note that the unit is in milliseconds. As an example:

```js
// This gives the server 10 seconds to gracefully shutdown.
pubSub.shutdown(10000);
```


### Client

See [publication-client](https://github.com/mixmaxhq/publication-client) for the client for this server.
