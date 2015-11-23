docker-listener
===============

System service that pipes Docker daemon events into RabbitMQ. Installed on each dock and communicates with docker over HTTP.

![docker events]
(https://docs.docker.com/reference/api/images/event_state.png)

## Architecture

![Docker-listener Architecture] (https://docs.google.com/drawings/d/16sCOUl6jzLPofknkl_x-krzHL6BKGe8oQslPLPR0Ef4/pub?w=1440&h=1080)

Docker-listener get all events from the Docker daemon using [remote API over HTTP endpoint](https://docs.docker.com/engine/reference/api/docker_remote_api/).
Most of the events are getting enhanced with container inspect information [`docker inspect`](https://docs.docker.com/engine/reference/commandline/inspect/) and published to RabbitMQ. Events from Docker-listener later processed by API, Mavis, Sauron and other systems.
Docker-listener deployed as a service on each dock.

## Published jobs
  * `docker.events-stream.disconnected` - docker daemon went down.
  * `docker.events-stream.connected` - docker-listener was able to connect to the docker daemon.
  * `on-instance-container-create` - instance container was created
  * `on-image-builder-container-create` - image builder container was created
  * `on-instance-container-die` - instance container died
  * `on-image-builder-container-die` - image builder container died
  * `container.life-cycle.started` - any container started
  * `container.life-cycle.died` - any container died


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
