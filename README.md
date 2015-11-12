docker-listener
===============

Publish Docker events into Redis

![docker events]
(https://docs.docker.com/reference/api/images/event_state.png)


## Install & Run

To install:
```
  npm install
```

To run:
```
  npm start
```

Before running please check *ENV* variables in the `./configs` directory.


To run tests:

```
  npm test
  npm run test-watch
```

## Supported events

This module supports all standard docker events like 'create', 'destroy', 'die', 'export', 'kill', 'pause', 'restart', 'start', 'stop', 'unpause', 'untag', 'delete'.
Two additional events are emitted:
  * `docker.events-stream.disconnected` event when docker daemon went down.
  * `docker.events-stream.connected` event when we were able to connect to the docker daemon.

Each payload will be in the JSON format.
Payload has all fields provided by Docker plus additional `ip` property.
