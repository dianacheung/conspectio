const express = require('express');
const app = express();
const http = require ('http').Server(app);
const io = require ('socket.io')(http);
const path = require('path');

app.get('/', (req,res) => {
	res.sendFile(path.resolve('client/index.html'));
	
});

app.use(express.static('client'));

var eventTracker = {};

io.on('connection', (socket) => {
  //echo test
  socket.emit('echo', 'server side socket!');
  
  console.log('socket connected', socket.id);

  //listens for event tag from broadcaster
  socket.on('sendEventTag', (eventTag) => {

    if(!eventTracker[eventTag]) {
      eventTracker[eventTag] = {
        broadcasters: {}, 
        viewers: {}  
      };

      eventTracker[eventTag].broadcasters[socket.id] = socket.id;
    } else {
      eventTracker[eventTag].broadcasters[socket.id] = socket.id;
      for(var viewer in eventTracker[eventTag].viewers) {
        io.to(socket.id).emit('initiateConnection', viewer);
      }
    } 
    console.log('eventTracker:', eventTracker);
  })

  //listens for broadcaster when they stop streaming
  socket.on('removeBroadcaster', (eventTag) => {
    delete eventTracker[eventTag].broadcasters[socket.id];
    if(!Object.keys(eventTracker[eventTag].broadcasters).length) {
      //need to handle viewer side (redirect viewers back to event page)
      delete eventTracker[eventTag];
    }
    console.log('eventTracker',eventTracker);
  });

  //listens for eventList request from viewer
  socket.on('getEventList', () => {
    socket.emit('sendEventList', Object.keys(eventTracker));
  });

  // listens for initiate view request from viewer
  socket.on('initiateView', (eventTag) => {
    // add this viewer socket to eventTracker
    if(eventTracker[eventTag]) {
      eventTracker[eventTag].viewers[socket.id] = socket.id; // save ref to this socket obj
      console.log('inside initiateView', eventTracker);

      // send message to broadcaster that a viewer wants to connect
      var broadcasterSocketIdArr = Object.keys(eventTracker[eventTag].broadcasters); // for now, pick the 1st broadcaster for this eventTag

      for(var i = 0; i < broadcasterSocketIdArr.length; i++) {
      console.log('broadcasterSocketIdArr', broadcasterSocketIdArr[i]);
        // server emits a message to broadcaster to initiate connection
        // socket.id is from viewer
        io.to(broadcasterSocketIdArr[i]).emit('initiateConnection', socket.id);
      }
    }
  });

  socket.on('signal', (toId, message) => {
    console.log('inside signal', toId);
    // send the peerObj to the peerId
    io.to(toId).emit('signal', socket.id, message);
  });

  //listens for disconnection
  socket.on('disconnect', () => {
    console.log('this user left:', socket.id, 'socket:');
    socket.emit('user disconnected');
    for (var key in eventTracker){
      console.log('broadcaster disconnected. eventTracker in for loop:', eventTracker);
      if (eventTracker[key].broadcasters[socket.id]) {
        var eventTag = key;
        console.log('eventTag:', key);
        delete eventTracker[eventTag].broadcasters[socket.id];
        console.log('eventTracker[eventTag]', eventTracker[eventTag]);
        if(Object.keys(eventTracker[eventTag].broadcasters).length === 0){
          
          console.log('no more broadcasters for this event');
          if (Object.keys(eventTracker[eventTag].viewers).length){
            for (var viewer in eventTracker[eventTag].viewers){
              //redirect viewers to events.html
              
              var destination = './events.html';
              io.to(viewer).emit('redirectToEvents', destination);
              delete eventTracker[eventTag];
            }
          }
          
        }
      } 
      else if (eventTracker[key].viewers[socket.id]){
        delete eventTracker[key].viewers[socket.id];
      }
    }
  });
});

http.listen(3000, function(){
	console.log('listening on 3000');
});

module.export = http;