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

var pubServer = new PublicationServer({
  authFn: authenticationFunction,
  mountPath: '/ws',
  server
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


### Client

See [@mixmaxhq/publication-client](https://github.com/mixmaxhq/publication-server/blob/master/client/README.md) for the client for this server.
