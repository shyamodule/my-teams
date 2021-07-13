'use strict';

const { connect, createLocalVideoTrack, Logger } = require('twilio-video');
const { isMobile } = require('./browser');


const $leave = $('#leave-call');
const $call = $('#call');
const $activeParticipant = $('div#active-participant > div.participant.main', $call);
const $activeVideo = $('video', $activeParticipant);
const $participants = $('div#participants', $call);

let activeParticipant = null;
let isActiveParticipantPinned = false;


function setActiveParticipant(participant) {
  if (activeParticipant) {
    const $activeParticipant = $(`div#${activeParticipant.sid}`, $participants);
    $activeParticipant.removeClass('active');
    $activeParticipant.removeClass('pinned');

    const { track: activeTrack } = Array.from(activeParticipant.videoTracks.values())[0] || {};
    if (activeTrack) {
      activeTrack.detach($activeVideo.get(0));
      $activeVideo.css('opacity', '0');
    }
  }

  activeParticipant = participant;
  const { identity, sid } = participant;
  const $participant = $(`div#${sid}`, $participants);

  $participant.addClass('active');
  if (isActiveParticipantPinned) {
    $participant.addClass('pinned');
  }

  const { track } = Array.from(participant.videoTracks.values())[0] || {};
  if (track) {
    track.attach($activeVideo.get(0));
    $activeVideo.css('opacity', '');
  }

  $activeParticipant.attr('data-identity', identity);
}


function setCurrentActiveParticipant(call) {
  const { dominantSpeaker, localParticipant } = call;
  setActiveParticipant(dominantSpeaker || localParticipant);
}


function setupParticipantContainer(participant, call) {
  const { identity, sid } = participant;

  const $container = $(`<div class="participant" data-identity="${identity}" id="${sid}">
    <audio autoplay ${participant === call.localParticipant ? 'muted' : ''} style="opacity: 0"></audio>
    <video autoplay muted playsinline style="opacity: 0"></video>
  </div>`);

  $container.on('click', () => {
    if (activeParticipant === participant && isActiveParticipantPinned) {
      setVideoPriority(participant, null);
      isActiveParticipantPinned = false;
      setCurrentActiveParticipant(call);
    } else {
      if (isActiveParticipantPinned) {
        setVideoPriority(activeParticipant, null);
      }
      setVideoPriority(participant, 'high');
      isActiveParticipantPinned = true;
      setActiveParticipant(participant);
    }
  });

  $participants.append($container);
}


function setVideoPriority(participant, priority) {
  participant.videoTracks.forEach(publication => {
    const track = publication.track;
    if (track && track.setPriority) {
      track.setPriority(priority);
    }
  });
}


function attachTrack(track, participant) {
  const $media = $(`div#${participant.sid} > ${track.kind}`, $participants);
  $media.css('opacity', '');
  track.attach($media.get(0));

  if (track.kind === 'video' && participant === activeParticipant) {
    track.attach($activeVideo.get(0));
    $activeVideo.css('opacity', '');
  }
}


function detachTrack(track, participant) {
  const $media = $(`div#${participant.sid} > ${track.kind}`, $participants);
  $media.css('opacity', '0');
  track.detach($media.get(0));

  if (track.kind === 'video' && participant === activeParticipant) {
    track.detach($activeVideo.get(0));
    $activeVideo.css('opacity', '0');
  }
}


function participantConnected(participant, call) {

  setupParticipantContainer(participant, call);

  participant.tracks.forEach(publication => {
    trackPublished(publication, participant);
  });

  participant.on('trackPublished', publication => {
    trackPublished(publication, participant);
  });
}


function participantDisconnected(participant, call) {

  if (activeParticipant === participant && isActiveParticipantPinned) {
    isActiveParticipantPinned = false;
    setCurrentActiveParticipant(call);
  }

  $(`div#${participant.sid}`, $participants).remove();
}


function trackPublished(publication, participant) {

  if (publication.track) {
    attachTrack(publication.track, participant);
  }

  publication.on('subscribed', track => {
    attachTrack(track, participant);
  });

  publication.on('unsubscribed', track => {
    detachTrack(track, participant);
  });
}


async function joinCall(token, connectOptions) {
  
  const logger = Logger.getLogger('twilio-video');
  logger.setLevel('debug');

  const call = await connect(token, connectOptions);

  // Save the LocalVideoTrack.
  let localVideoTrack = Array.from(call.localParticipant.videoTracks.values())[0].track;

  // Make the call available in the JavaScript console for debugging.
  window.call = call;

  // Handle the LocalParticipant's media.
  participantConnected(call.localParticipant, call);

  // Subscribe to the media published by RemoteParticipants already in the call.
  call.participants.forEach(participant => {
    participantConnected(participant, call);
  });

  // Subscribe to the media published by RemoteParticipants joining the call later.
  call.on('participantConnected', participant => {
    participantConnected(participant, call);
  });

  // Handle a disconnected RemoteParticipant.
  call.on('participantDisconnected', participant => {
    participantDisconnected(participant, call);
  });

  // Set the current active Participant.
  setCurrentActiveParticipant(call);

  // Update the active Participant when changed
  call.on('dominantSpeakerChanged', () => {
    if (!isActiveParticipantPinned) {
      setCurrentActiveParticipant(call);
    }
  });


  $leave.click(function onLeave() {
    $leave.off('click', onLeave);
    call.disconnect();
  });

  return new Promise((resolve, reject) => {

    window.onbeforeunload = () => {
      call.disconnect();
    };

    if (isMobile) {
      window.onpagehide = () => {
        call.disconnect();
      };

      document.onvisibilitychange = async () => {
        if (document.visibilityState === 'hidden') {
          localVideoTrack.stop();
          call.localParticipant.unpublishTrack(localVideoTrack);
        } else {
          localVideoTrack = await createLocalVideoTrack(connectOptions.video);
          await call.localParticipant.publishTrack(localVideoTrack);
        }
      };
    }

    call.once('disconnected', (call, error) => {
      window.onbeforeunload = null;
      if (isMobile) {
        window.onpagehide = null;
        document.onvisibilitychange = null;
      }

      localVideoTrack.stop();

      participantDisconnected(call.localParticipant, call);

      call.participants.forEach(participant => {
        participantDisconnected(participant, call);
      });

      $activeVideo.get(0).srcObject = null;

      window.call = null;

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

module.exports = joinCall;
