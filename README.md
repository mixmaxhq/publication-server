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
headers on the request. This is done in the authentication function that is
passed to the `publication-server` constructor. The function should be as
follows:

```js
function authenticationFunction(ws, done) {
  // Logic checking the websocket headers, etc.
  // ...
  // We get the ID of the user that this connection is for as a String.

  done(null, userId);
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
If we encounter an error prior to marking a publication as `ready`, we should
pass the error to `this.error()`. This will call the registered error handler,
and pass the error along to the client.
```js
pubSub.publish('PublicationName', function() {
  this.error(new Error('failed to do something require'));
});
```


#### Error handling
Errors passed to the error handler provided upon server initialization are
objects with there properties:

 - `error`: The original error that was reported by the publication.
 - `userId`: The ID of the user who was subscribing to the publication when the
   error occurred
 - `extra`: Any extra information that was recorded - currently this is the
   parameters that were provided to the publication.

### Client

See [@mixmaxhq/publication-client](https://github.com/mixmaxhq/publication-server/blob/master/client/README.md) for the client for this server.
