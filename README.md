docker-listener
===============

System service that pipes Docker daemon events into RabbitMQ. Installed on dock-services and communicates with docker and swarm over HTTP.

![docker events]
(https://docs.docker.com/reference/api/images/event_state.png)

## Architecture

![Docker-listener Architecture] (https://docs.google.com/drawings/d/16sCOUl6jzLPofknkl_x-krzHL6BKGe8oQslPLPR0Ef4/pub?w=1440&h=1080)

Docker-listener get all events from the Docker daemon using [remote API over HTTP endpoint](https://docs.docker.com/engine/reference/api/docker_remote_api/).
Most of the events are getting enhanced with container inspect information [`docker inspect`](https://docs.docker.com/engine/reference/commandline/inspect/) and published to RabbitMQ. Events from Docker-listener later processed by API, Sauron and other systems.
Docker-listener deployed as container to the dock-services box.

## Published jobs
  * `docker.events-stream.disconnected` - docker daemon went down.
  * `docker.events-stream.connected` - docker-listener was able to connect to the docker daemon.
  * `container.life-cycle.created` - any container created
  * `container.life-cycle.started` - any container started
  * `container.life-cycle.died` - any container died


## Formatting

This repository is formatted using the Standard JS rules.

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

Some helpful tips:

- `npm run lint` runs the standard linter, and will not format your code
- `npm run format` will run the standard formatter, attempting to fix various issues that are found
- [standard's README](https://github.com/feross/standard/blob/master/README.md) has some good information about various [text editor plugins](https://github.com/feross/standard/blob/master/README.md#text-editor-plugins) as well, to make your life easier


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
