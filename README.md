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
headers on the initial `UPGRADE` request. This is done in the authentication
function that is passed to the `publication-server` constructor. The function
should be as follows:

```js
function authenticationFunction(req, done) {
  // Logic checking the websocket headers, etc.

  // If the request failed authentication, return an error.
  if (failedAuth) done(new Error('failed to authenticate user'));

  // NOTE: you need to set a property called `userId` on the request object if
  // you would like to reference it inside of any given publication. This is
  // not required, but it is suggested to do.
  req.userId = user._id;

  // If the request passed authentication, call the callback without any
  // params.
  done();
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

See [publication-client](https://github.com/mixmaxhq/publication-server/blob/master/client/README.md) for the client for this server.
