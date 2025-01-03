/**
 * web/src/views/Chat.js
 */

import React from 'react';
import { Row, Spinner, Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';
import {
  ContactHeader,
  Contacts,
  ChatHeader,
  Messages,
  MessageForm,
  UserProfile,
  EditProfile,
} from 'components';
import socketIO from 'socket.io-client';
import Auth from 'Auth';

class Chat extends React.Component {
  state = {
    contacts: [],
    contact: {},         // Will hold { id, name, ... } of the current chat
    userProfile: false,
    profile: false,

    // Existing message-related states
    connected: false,
    messages: [],
    typing: false,
    timeout: null,
    user: null,

    // ------ CALL STATES ------
    callState: 'idle',  // 'idle' | 'calling' | 'receiving' | 'inCall'
    incomingCallModal: false,
    callerInfo: null,   // Will hold { from, callerName }

    // WebRTC
    localStream: null,
    remoteStream: null,
    peerConnection: null,

    // NEW: Store an SDP offer if it arrives before we have a peerConnection.
    pendingOffer: null,
  };

  componentDidMount() {
    // Initialize socket.io connection.
    this.initSocketConnection();
  }

  // ============ SOCKET.IO CONNECTION & EVENTS ============
  initSocketConnection = () => {
    const socket = socketIO(process.env.REACT_APP_SOCKET, {
      query: 'token=' + Auth.getToken(),
    });

    // --- Existing events ---
    socket.on('connect', () => {
      console.log('[CHAT] Socket connected');
      this.setState({ connected: true });
    });
    socket.on('disconnect', () => {
      console.log('[CHAT] Socket disconnected');
      this.setState({ connected: false });
    });
    socket.on('data', this.onData);
    socket.on('message', this.onNewMessage);
    socket.on('user_status', this.updateUsersState);
    socket.on('typing', this.onTypingMessage);
    socket.on('error', this.onSocketError);

    // ---------------- NEW: CALL EVENTS ----------------
    socket.on('incomingCall', (data) => {
      // data => { from: userId, callerName: ... }
      console.log('[CHAT] Incoming call from:', data);
      this.setState({
        callState: 'receiving',
        incomingCallModal: true,
        callerInfo: data,   // store who is calling
      });

      // OPTIONAL: Update contact so we know who we're talking to
      if (!this.state.contact.id || this.state.contact.id !== data.from) {
        this.setState({
          contact: {
            ...this.state.contact,
            id: data.from,
            name: data.callerName,
          },
        });
      }
    });

    // --- IMPORTANT CHANGE HERE: Store or handle the offer ---
    socket.on('offer', ({ sdp, caller }) => {
      console.log('[CHAT] Received offer from:', caller);
      // If we already have a peerConnection, handle it right away.
      if (this.state.peerConnection) {
        this.handleOffer(sdp, caller);
      } else {
        // We haven't accepted the call yet => store it in state until we create peerConnection
        console.log('[CHAT] No peerConnection yet. Storing pendingOffer...');
        this.setState({ pendingOffer: { sdp, caller } });
      }
    });

    socket.on('answer', ({ sdp, callee }) => {
      console.log('[CHAT] Received answer from:', callee);
      if (this.state.peerConnection) {
        const desc = new RTCSessionDescription(sdp);
        this.state.peerConnection.setRemoteDescription(desc)
          .then(() => {
            console.log('[CHAT] Remote description set for answer, callState = inCall');
            this.setState({ callState: 'inCall' });
          })
          .catch(err => console.error('[CHAT] Error setting remote desc (answer)', err));
      }
    });

    socket.on('iceCandidate', ({ candidate, from }) => {
      console.log('[CHAT] Received ICE candidate from:', from);
      if (this.state.peerConnection && candidate) {
        this.state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(e => console.error('[CHAT] Error adding ICE candidate', e));
      }
    });

    socket.on('hangUp', () => {
      console.log('[CHAT] Call ended by remote');
      this.endCall();
    });

    this.setState({ socket });
  };

  // Helper to handle incoming offer -> setRemoteDesc -> createAnswer
  handleOffer = (sdp, caller) => {
    console.log('[CHAT] handleOffer => Setting remote desc & creating answer...');
    const desc = new RTCSessionDescription(sdp);
    this.state.peerConnection.setRemoteDescription(desc)
      .then(() => {
        console.log('[CHAT] Remote description set (offer). Creating answer...');
        return this.state.peerConnection.createAnswer();
      })
      .then(answer => {
        console.log('[CHAT] Created answer, setting local desc and sending...');
        this.state.peerConnection.setLocalDescription(answer);
        this.state.socket.emit('answer', {
          sdp: answer,
          target: caller,
        });
        this.setState({ callState: 'inCall' });
      })
      .catch(err => console.error('[CHAT] Error handling offer->answer', err));
  };

  // ============ CALLING FUNCTIONS ============
  initiateCall = (contact) => {
    if (!contact.id) return;
    console.log('[CHAT] Initiating call with contact:', contact.id);

    this.setState({
      callState: 'calling',
      contact: contact,
    });

    // Notify the callee that we're calling
    this.state.socket.emit('callUser', {
      recipientId: contact.id,
      callerName: this.state.user?.username || 'Unknown Caller',
    });

    // Access microphone (audio only)
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        console.log('[CHAT] Got localStream, tracks:', stream.getAudioTracks());
        this.setState({ localStream: stream });

        const peerConnection = this.createPeerConnection();

        // Add local tracks
        stream.getTracks().forEach(track => {
          console.log('[CHAT] Adding local track:', track.label);
          peerConnection.addTrack(track, stream);
        });

        // Create offer
        peerConnection.createOffer()
          .then(offer => {
            console.log('[CHAT] Created offer, setting local desc');
            peerConnection.setLocalDescription(offer);
            console.log('[CHAT] Sending offer to server...');
            this.state.socket.emit('offer', {
              sdp: offer,
              target: contact.id,
            });
          })
          .catch(err => console.error('[CHAT] Offer creation error', err));

        this.setState({ peerConnection });
      })
      .catch(err => console.error('[CHAT] getUserMedia error', err));
  };

  acceptCall = () => {
    console.log('[CHAT] Accepting call from:', this.state.callerInfo);
    this.setState({
      incomingCallModal: false,
      callState: 'inCall',
    });

    const callerId = this.state.callerInfo?.from;
    if (callerId && (!this.state.contact.id || this.state.contact.id !== callerId)) {
      this.setState({
        contact: {
          ...this.state.contact,
          id: callerId,
          name: this.state.callerInfo.callerName,
        },
      });
    }

    // Access microphone (audio only for now)
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        console.log('[CHAT] Got localStream (callee), tracks:', stream.getAudioTracks());
        this.setState({ localStream: stream });

        const peerConnection = this.createPeerConnection();

        // Add local tracks
        stream.getTracks().forEach(track => {
          console.log('[CHAT] Callee adding local track:', track.label);
          peerConnection.addTrack(track, stream);
        });

        // Once the peerConnection is ready, if there's a stored pendingOffer, handle it now.
        this.setState({ peerConnection }, () => {
          if (this.state.pendingOffer) {
            const { sdp, caller } = this.state.pendingOffer;
            this.handleOffer(sdp, caller);
            this.setState({ pendingOffer: null });
          }
        });
      })
      .catch(err => console.error('[CHAT] Error accessing mic (callee)', err));
  };

  rejectCall = () => {
    console.log('[CHAT] Rejecting call from:', this.state.callerInfo);
    this.setState({
      incomingCallModal: false,
      callState: 'idle',
      callerInfo: null,
      pendingOffer: null, // discard any stored offer
    });
    // Optionally notify the caller that call is rejected
    // e.g. this.state.socket.emit('callRejected', {...});
  };

  createPeerConnection = () => {
    console.log('[CHAT] Creating RTCPeerConnection...');
    const configuration = {
      iceServers: [
        { urls: 'stun:stun1.l.google.com:19302' },
        // Add a TURN server if needed for NAT traversal
      ],
    };
    const peerConnection = new RTCPeerConnection(configuration);

    // On ICE candidate
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const targetId =
          this.state.contact.id ||
          (this.state.callerInfo && this.state.callerInfo.from);
        console.log('[CHAT] Sending ICE candidate to:', targetId);
        this.state.socket.emit('iceCandidate', {
          candidate: event.candidate,
          target: targetId,
        });
      } else {
        console.log('[CHAT] ICE gathering complete (no more candidates)');
      }
    };

    // On track (remote stream)
    peerConnection.ontrack = (event) => {
      console.log('[CHAT] ontrack => remote track label:', event.track.label);
      this.setState({ remoteStream: event.streams[0] });
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log('[CHAT] PeerConnection state:', state);
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        console.log('[CHAT] PeerConnection ended, calling endCall()');
        this.endCall();
      }
    };

    return peerConnection;
  };

  endCall = () => {
    console.log('[CHAT] endCall invoked');
    const { socket, contact, callerInfo, peerConnection, localStream, callState } = this.state;
    const targetId = contact.id || (callerInfo && callerInfo.from);

    // If we are calling or in call, notify other side
    if (callState === 'calling' || callState === 'inCall') {
      console.log('[CHAT] Emitting hangUp to target:', targetId);
      socket.emit('hangUp', { target: targetId });
    }

    // Close peerConnection
    if (peerConnection) {
      console.log('[CHAT] Closing peerConnection...');
      peerConnection.close();
    }

    // Stop local media
    if (localStream) {
      console.log('[CHAT] Stopping localStream tracks');
      localStream.getTracks().forEach(track => track.stop());
    }

    this.setState({
      callState: 'idle',
      peerConnection: null,
      localStream: null,
      remoteStream: null,
      callerInfo: null,
      incomingCallModal: false,
      pendingOffer: null, // clear any pending offer
    });
  };

  // ============ EXISTING MESSAGING LOGIC ============
  onData = (user, contacts, messages, users) => {
    console.log('[CHAT] onData => user:', user, ' contacts:', contacts.length);
    let contact = contacts[0] || {};
    this.setState({ messages, contacts, user, contact }, () => {
      this.updateUsersState(users);
    });
  };

  onNewMessage = (message) => {
    if (message.sender === this.state.contact.id) {
      this.setState({ typing: false });
      this.state.socket.emit('seen', this.state.contact.id);
      message.seen = true;
    }
    let newMessages = this.state.messages.concat(message);
    this.setState({ messages: newMessages });
  };

  onTypingMessage = (sender) => {
    if (this.state.contact.id !== sender) return;
    this.setState({ typing: sender });
    clearTimeout(this.state.timeout);
    const timeout = setTimeout(() => this.setState({ typing: false }), 3000);
    this.setState({ timeout });
  };

  onSocketError = (err) => {
    console.error('[CHAT] Socket error:', err);
    if (err === 'auth_error') {
      Auth.logout();
      this.props.history.push('/login');
    }
  };

  updateUsersState = (users) => {
    let contacts = this.state.contacts;
    contacts.forEach((element, index) => {
      if (users[element.id]) contacts[index].status = users[element.id];
    });
    this.setState({ contacts });
    let contact = this.state.contact;
    if (users[contact.id]) contact.status = users[contact.id];
    this.setState({ contact });
  };

  sendMessage = (message) => {
    if (!this.state.contact.id) return;
    message.receiver = this.state.contact.id;
    let newMessages = this.state.messages.concat(message);
    this.setState({ messages: newMessages });
    this.state.socket.emit('message', message);
  };

  sendType = () => {
    if (this.state.contact.id) {
      this.state.socket.emit('typing', this.state.contact.id);
    }
  };

  logout = () => {
    console.log('[CHAT] Logging out user');
    this.state.socket.disconnect();
    Auth.logout();
    this.props.history.push('/');
  };

  // ============ RENDERING ============
  render() {
    if (!this.state.connected || !this.state.contacts || !this.state.messages) {
      return <Spinner id="loader" color="success" />;
    }

    return (
      <Row className="h-100">
        {/* LEFT: Contacts Section */}
        <div id="contacts-section" className="col-6 col-md-4">
          <ContactHeader user={this.state.user} toggle={this.profileToggle} />
          <Contacts
            contacts={this.state.contacts}
            messages={this.state.messages}
            onChatNavigate={this.onChatNavigate}
          />
          <UserProfile
            contact={this.state.contact}
            toggle={this.userProfileToggle}
            open={this.state.userProfile}
          />
          <EditProfile
            user={this.state.user}
            toggle={this.profileToggle}
            open={this.state.profile}
          />
        </div>

        {/* RIGHT: Messages Section */}
        <div id="messages-section" className="col-6 col-md-8">
          <ChatHeader
            contact={this.state.contact}
            typing={this.state.typing}
            toggle={this.userProfileToggle}
            logout={this.logout}
            // pass the call method so ChatHeader can call
            onCall={this.initiateCall}
          />
          {this.renderChat()}
          <MessageForm sender={this.sendMessage} sendType={this.sendType} />

          {/* Hang Up button if in a call */}
          {(this.state.callState === 'calling' || this.state.callState === 'inCall') && (
            <Button color="danger" onClick={this.endCall} className="mt-2">
              Hang Up
            </Button>
          )}

          {/* Audio element for remote stream */}
          {this.state.remoteStream && (
            <audio
              ref={(audioEl) => {
                if (audioEl && this.state.remoteStream) {
                  console.log('[CHAT] Attaching remoteStream to audio element');
                  audioEl.srcObject = this.state.remoteStream;
                }
              }}
              autoPlay
            />
          )}
        </div>

        {/* INCOMING CALL MODAL */}
        <Modal isOpen={this.state.incomingCallModal}>
          <ModalHeader>Incoming Call</ModalHeader>
          <ModalBody>
            {this.state.callerInfo && (
              <p>{this.state.callerInfo.callerName} is calling...</p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="success" onClick={this.acceptCall}>Accept</Button>
            <Button color="secondary" onClick={this.rejectCall}>Reject</Button>
          </ModalFooter>
        </Modal>
      </Row>
    );
  }

  renderChat = () => {
    const { contact, user, messages } = this.state;
    if (!contact || !contact.id) return null;
    let filtered = messages.filter(
      (m) => m.sender === contact.id || m.receiver === contact.id
    );
    return <Messages user={user} messages={filtered} />;
  };

  onChatNavigate = (contact) => {
    console.log('[CHAT] onChatNavigate => switching to contact:', contact.id);
    this.setState({ contact });
    this.state.socket.emit('seen', contact.id);
    let newMessages = this.state.messages.map((m) => {
      if (m.sender === contact.id) {
        return { ...m, seen: true };
      }
      return m;
    });
    this.setState({ messages: newMessages });
  };

  userProfileToggle = () => this.setState({ userProfile: !this.state.userProfile });
  profileToggle = () => this.setState({ profile: !this.state.profile });
}

export default Chat;
