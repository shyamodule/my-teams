'use strict';

const { isSupported } = require('twilio-video');

const { isMobile } = require('./browser');
const joinCall = require('./joincall');
const selectMedia = require('./selectmedia');
const selectRoom = require('./selectroom');
const expressError = require('./utils/expresserror');
const micLevel = require('./utils/miclevel');

const $modals = $('#modals');
const $selectMicModal = $('#select-mic', $modals);
const $selectCameraModal = $('#select-camera', $modals);
const $showErrorModal = $('#show-error', $modals);
const $joinRoomModal = $('#join-room', $modals);

const $call = $('#call');
const $joinCallBtn = $('#join-call-btn');
const $leaveRoomBtn = $('#leave-room');

// ConnectOptions settings for a video web application.
const connectOptions = {

  bandwidthProfile: {
    video: {
      dominantSpeakerPriority: 'high',
      mode: 'collaboration',
      clientTrackSwitchOffControl: 'auto',
      contentPreferencesMode: 'auto'
    }
  },

  dominantSpeaker: true,
  maxAudioBitrate: 16000, //if you want to play music, comment this line
  preferredVideoCodecs: [{ codec: 'VP8', simulcast: true }],
  video: { height: 720, frameRate: 24, width: 1280 }//720p @24fps
};

// For mobile browsers, limit the maximum incoming video bitrate to 2.5 Mbps.
if (isMobile) {
  connectOptions.bandwidthProfile.video.maxSubscriptionBitrate = 2500000;
}


const deviceIds = {
  audio: isMobile ? null : localStorage.getItem('audioDeviceId'),
  video: isMobile ? null : localStorage.getItem('videoDeviceId')
};


async function selectAndJoinRoom(error = null) {
  const formData = await selectRoom($joinRoomModal, error);
  const { identity, roomId } = formData;

  // chat functionality
  $(function() {

    var $chatWindow = $('#messages');
    var chatClient;
    var generalChannel;
    var username;
  
    // Helper function to print info messages to the chat window
    function print(infoMessage, asHtml) {
      var $msg = $('<div class="info">');
      if (asHtml) {
        $msg.html(infoMessage);
      } else {
        $msg.text(infoMessage);
      }
      $chatWindow.append($msg);
    }
  
    // Helper function to print chat message to the chat window
    function printMessage(fromUser, message) {
      var $user = $('<span class="username">').text(fromUser + ':');
      if (fromUser === username) {
        $user.addClass('me');
      }
      var $message = $('<span class="message">').text(message);
      var $container = $('<div class="message-container">');
      $container.append($user).append($message);
      $chatWindow.append($container);
      $chatWindow.scrollTop($chatWindow[0].scrollHeight);
    }
  
    print('Logging in...');
    
    
    $.get('/token/' + identity, {}, function(data) {

      Twilio.Chat.Client.create(data).then(client => {
        console.log('Created chat client');
        chatClient = client;
        chatClient.getSubscribedChannels().then(createOrJoinGeneralChannel);
  
        chatClient.on('tokenAboutToExpire', function() {
          refreshToken(username);
        });
  
        chatClient.on('tokenExpired', function() {
          refreshToken(username);
        });
  
      username = identity;
      print('Username: '
      + '<span class="me">' + username + '</span>', true);
  
      }).catch(error => {selectAndJoinRoom(error);});
    });
  
    function refreshToken(identity) {
      console.log('Token about to expire');
      $.get('/token/' + identity, function(Data) {
        console.log('updated token for chat client');          
        chatClient.updateToken(Data);
      });
    }
  
    function createOrJoinGeneralChannel() {
      print(`Channel name: "${roomId}" `);
      chatClient.getChannelByUniqueName(`${roomId}`)
      .then(function(channel) {
        generalChannel = channel;
        console.log(`Found ${roomId} channel:`);
        console.log(generalChannel);
        setupChannel();
      }).catch(function() {
        // If it doesn't exist, let's create it
        console.log(`Creating ${roomId} channel`);
        chatClient.createChannel({
          uniqueName: `${roomId}`,
          friendlyName: `${roomId} Chat Channel`
        }).then(function(channel) {
          console.log(`Created ${roomId} channel`);
          console.log(channel);
          generalChannel = channel;
          setupChannel();
        }).catch(function(channel) {
          console.log('Channel could not be created:');
          console.log(channel);
        });
      });
    }
  
    // Set up channel after it has been found
    function setupChannel() {
      generalChannel.join().then(function(channel) {
        print('Joined channel as '
        + '<span class="me">' + username + '</span>.', true);
      });
  
      generalChannel.on('messageAdded', function(message) {
        printMessage(message.author, message.body);
      });
    }
    
    $leaveRoomBtn.on("click", function leaveRoom() {
      $leaveRoomBtn.off('click', leaveRoom);
      $chatWindow.text('');
      $('#chat-input').off('keydown');
      generalChannel.leave().then(function() {
        console.log(`${username} left the room`);});
      generalChannel.removeListener('messageAdded', printMessage);
    return selectAndJoinRoom();
  });  
    var $input = $('#chat-input');
    $input.on('keydown', function(e) {
  
      if (e.keyCode == 13) {
        if (generalChannel === undefined) {
          print('The Chat Service is not configured. Please check your .env file.', false);
          return;
        }
        generalChannel.sendMessage($input.val())
        $input.val('');
      }
    });
  });

  $joinCallBtn.click(function onJoin() {
    $joinCallBtn.off('click', onJoin);
    $joinCallBtn.addClass('d-none');
    $leaveRoomBtn.addClass('d-none');
    $call.removeClass('d-none');
    selectMicrophone();
  });
  
  async function Call() {

    try {

      const response = await fetch(`/token/${identity}`);
      const token = await response.text();

      connectOptions.audio = { deviceId: { exact: deviceIds.audio } };
      connectOptions.name = roomId;
      connectOptions.video.deviceId = { exact: deviceIds.video };
  
      // Join the Room.
      await joinCall(token, connectOptions);
      
      $joinCallBtn.removeClass('d-none');
      $leaveRoomBtn.removeClass('d-none');
      $call.addClass('d-none');
    } catch (error) {
      return selectAndJoinRoom(error);
    }

  }
  
  async function selectCamera() {
    if (deviceIds.video === null) {
      try {
        deviceIds.video = await selectMedia('video', $selectCameraModal, videoTrack => {
          const $video = $('video', $selectCameraModal);
          videoTrack.attach($video.get(0))
        });
      } catch (error) {
        expressError($showErrorModal, error);
        return;
      }
    }
    return Call();
    }
  
  async function selectMicrophone() {
    if (deviceIds.audio === null) {
      try {
        deviceIds.audio = await selectMedia('audio', $selectMicModal, audioTrack => {
          const $levelIndicator = $('svg rect', $selectMicModal);
          const maxLevel = Number($levelIndicator.attr('height'));
          micLevel(audioTrack, maxLevel, level => $levelIndicator.attr('y', maxLevel - level));
        });
      } catch (error) {
        expressError($showErrorModal, error);
        return 0;
      }
    }
    return selectCamera();
    }
    

}



window.addEventListener('load', isSupported ? () => {
  console.log("Twilio is supported");
  selectAndJoinRoom(); 
} : () => {
  expressError($showErrorModal, new Error('This browser is not supported.'));
});

