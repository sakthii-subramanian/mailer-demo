// app.js

const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const readline = require('readline-promise');

// Load your credentials from the downloaded JSON file
const credentials = require('./credentials.json');

// Set up OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  credentials.web.client_id,
  credentials.web.client_secret,
  credentials.web.redirect_uris[0]
);

// Set the scope for the Gmail API
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.settings.basic'];

// Create an OAuth2 URL to get the authorization code
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
});

console.log('Authorize this app by visiting this URL:', authUrl);

const rlp=readline.default;
const rl = rlp.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Get the authorization code from the user
rl.question('Enter the code from the URL here: ', async (code) => {
  rl.close();

  // Get access token using the authorization code
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Use the Gmail API
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Example: List labels
  const res = await gmail.users.labels.list({ userId: 'me' });
  const labels = res.data.labels;
  console.log('Labels:', labels);

  
  // Turn on vacation mode
  const vacationSettings = {
    enableAutoReply: true,
    responseSubject: 'Out of Office',
    responseBodyPlainText: 'I am currently out of the office.',
    restrictToContacts: false,
    restrictToDomain: false,
    startDate: new Date().toISOString(),
    endDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  await gmail.users.settings.updateVacation({ userId: 'me', requestBody: vacationSettings });

  console.log('Vacation mode turned on.');

  // Close the readline interface
  rl.close();
});

// Handle readline close event
rl.on('close', () => {
  console.log('Application closed.');
});
