//refactored viewer.js to a class constructor
var eventTag = window.location.search.substring(5);
$('#eventName').html(eventTag);

var connections = {};

class ConspectioViewer {
  constructor(broadcasterId) {
    this.broadcasterId = broadcasterId;
    this.pc; 
  }

  init() {
    this.pc = new RTCPeerConnection(null);
    this.pc.broadcasterId = this.broadcasterId;
    this.pc.onicecandidate = this.handleIceCandidate;
    this.pc.onaddstream = this.handleRemoteStreamAdded;
    this.pc.onremovestream = this.handleRemoteStreamRemoved;
    this.pc.oniceconnectionstatechange = this.handleIceConnectionChange;
  }

  handleIceCandidate(event) {
    console.log('handleIceCandidate event: ', event);
    if(event.candidate) {
      send(this.broadcasterId, {
        type: "candidate",
        candidate: event.candidate
      });
    }
  }

  handleRemoteStreamAdded(event) {
    console.log('got a stream from broadcaster');
    // got remote video stream, now let's show it in a video tag
    var video = $('<video class="newVideo"></video>').attr(
      {
        'src': window.URL.createObjectURL(event.stream),
        'autoplay': true
      });
    $('#videosDiv').append(video);
  }

  handleRemoteStreamRemoved(event) {
    console.log('broadcaster stream removed');
  }

  handleIceConnectionChange() {
    if(this.pc) {
      console.log('inside handleIceCandidateDisconnect', this.pc.iceConnectionState);
      if(this.pc.iceConnectionState === 'disconnected') {
        console.log('inside pc.onIceConnectionState')
        this.pc.close();
        delete connections[this.broadcasterId];
      }
    }
  }

  receiveOffer(offer) {
    this.pc.setRemoteDescription(new RTCSessionDescription(offer));
  }

  createAnswerWrapper() {
    this.pc.createAnswer( (answer) => {
      this.pc.setLocalDescription(new RTCSessionDescription(answer));

      send(this.broadcasterId, {
        type: "answer",
        answer: answer
      });
    }, (error) => {
      console.log('Error with creating viewer offer', error);
    });
  }

  addCandidate(candidate) {
    this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
 
}

const socket = io();

send = (broadcasterId, message) => {
  console.log('viewer send broadcasterId', broadcasterId);
  socket.emit('signal', broadcasterId, message);
}

socket.on('connect', () => {
  console.log('viewer socket connected', socket.id);

  // view wants to initiate contact with broadcaster
  socket.emit('initiateView', eventTag);

  socket.on('signal', (fromId, message) => {
    if(message.type === 'offer') {
      var newPC = new ConspectioViewer(fromId);
      connections[fromId] = newPC;
      newPC.init();
      newPC.receiveOffer(message.offer);
      newPC.createAnswerWrapper();
    } else if (message.type === 'candidate') {
      var currentPC = connections[fromId];
      currentPC.addCandidate(message.candidate);
    }
  });

    //redirect viewer to events page if there are no more broadcasters streaming their event
  socket.on('redirectToEvents', (destination) => {
    console.log('redirecting viewer to events page');
    window.location.href = destination;
  });

});