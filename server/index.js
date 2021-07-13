'use strict';

require('dotenv').load();

const Twilio = require('twilio');

const express = require('express');
const http = require('http');
const path = require('path');
const bodyParser = require('body-parser');


const AccessToken = Twilio.jwt.AccessToken;
const ChatGrant = AccessToken.ChatGrant;
const VideoGrant = AccessToken.VideoGrant;


const app = express();

const quickstartPath = path.join(__dirname, '../public');
app.use(express.static(quickstartPath));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());




app.get('/token/:id?', function(req, res) {
  const id = req.params.id;
  res.send(tokenGenerator(id));
});

app.post('/token', (req, res) => {
  const id = req.body.id;
  res.send(tokenGenerator(id));
});


function tokenGenerator(identity) {
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
  );

  token.identity = identity;
  const videoGrant = new VideoGrant();
  token.addGrant(videoGrant);

  const chatGrant = new ChatGrant({
    serviceSid: process.env.TWILIO_CHAT_SERVICE_SID
  });
  token.addGrant(chatGrant);

  return token.toJwt();
}


// Create http server and run it.
const server = http.createServer(app);
const port = process.env.PORT || 3000;
server.listen(port, function() {
  console.log('Express server running on *:' + port);
});
