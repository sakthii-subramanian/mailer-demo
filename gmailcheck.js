// app.js

const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const readline = require('readline-promise');
const schedule = require('node-schedule');

// Load your credentials from the downloaded JSON file
const credentials = require('./credentials.json');

// Set up OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    credentials.web.client_id,
    credentials.web.client_secret,
    credentials.web.redirect_uris[0]
);

var repliedOnce=[]

// Set the scope for the Gmail API
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.settings.basic', 'https://www.googleapis.com/auth/gmail.labels', 'https://www.googleapis.com/auth/gmail.modify'];

function makeBody(to, from, subject, message) {
    var str = ["Content-Type: text/plain; charset=\"UTF-8\"\n",
        "MIME-Version: 1.0\n",
        "Content-Transfer-Encoding: 7bit\n",
        "to: ", to, "\n",
        "from: ", from, "\n",
        "subject: ", subject, "\n\n",
        message
    ].join('');

    var encodedMail = new Buffer(str).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
    return encodedMail;
}

async function getSenderEmailAddress(emailDetails) {
    try {

        const headers = emailDetails.data.payload.headers;

        // Find the 'From' header
        const fromHeader = headers.find(header => header.name === 'From');

        if (fromHeader) {
            // Extract the email address from the 'From' header
            const senderEmail = fromHeader.value;
            console.log(`Sender's email address: ${senderEmail}`);
            return senderEmail;
        } else {
            console.log('No "From" header found.');
            return null;
        }
    } catch (err) {
        console.error('Error getting sender email address:', err);
        return null;
    }
}

async function processEmails() {
    try {
        // Get the list of unread emails
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'label:UNREAD',
        });

        const messages = response.data.messages;

        if (messages) {
            console.log('unread count:', messages.length)

            // Process each unread email
            for (const message of messages) {
                const messageId = message.id;

                // Get the email details
                const emailDetails = await gmail.users.messages.get({
                    userId: 'me',
                    id: messageId,
                });

                // Check if the email has prior replies
                const hasPriorReplies = emailDetails.data.payload.headers.some(
                    (header) => header.name === 'In-Reply-To'
                );


                if (!hasPriorReplies && !repliedOnce.includes(messageId)) {

                    const hasAttentionLabel = emailDetails.data.labelIds.includes('attentionrequired');
                    if (!hasAttentionLabel) {
                        var senderEmail = await getSenderEmailAddress(emailDetails)

                        if (senderEmail) {
                            console.log(senderEmail)
                            var raw = makeBody(senderEmail, 'sakthi.subramanian.24@gmail.com', 'OUT OF OFFICE', 'Hey, I am vacation. wil get back to you in 2 days.Sorry for the delay.\nRegards,\nSakthi');
                            // Send a reply
                            await gmail.users.messages.send({
                                userId: 'me',
                                requestBody: {
                                    threadId: emailDetails.data.threadId,
                                    raw: raw, // Provide the actual content
                                },
                            });
                            repliedOnce.push(messageId)
                        }


                        // Add labels to the email
                        const labelsResponse = await gmail.users.labels.list({
                            userId: 'me',
                        });

                        const labels = labelsResponse.data.labels;
                        var attentionLabel = labels.find((label) => label.name === 'attentionrequired');

                        // If the label doesn't exist, create it
                        if (!attentionLabel) {
                            const createLabelResponse = await gmail.users.labels.create({
                                userId: 'me',
                                requestBody: {
                                    name: 'attentionrequired',
                                    messageListVisibility: 'show',
                                    labelListVisibility: 'labelShow',
                                },
                            });

                            attentionLabel = createLabelResponse.data;
                        }

                        await gmail.users.messages.modify({
                            userId: 'me',
                            id: messageId,
                            requestBody: {
                                addLabelIds: [attentionLabel.id],
                                removeLabelIds: ['INBOX'], // Remove from the inbox
                            },
                        });

                        console.log(`Replied to and labeled email with ID: ${messageId}`);
                    } else {
                        console.log(`Already added to label`)
                    }
                } else {
                    console.log(`Skipped email with prior replies. ID: ${messageId}`);
                }
            }
        }
        else {
            console.log('No unread messages to reply to');
        }
    } catch (err) {
        console.error('Error processing emails:', err);
    }
}

function scheduleProcessEmails() {
    // Random interval between 45 to 120 seconds
    const randomInterval = Math.floor(Math.random() * (120 - 45 + 1)) + 45;

    console.log(`Scheduling processEmails in ${randomInterval} seconds`);

    // Schedule the job
    schedule.scheduleJob(`*/${randomInterval} * * * * *`, async () => {
        await processEmails();
        scheduleProcessEmails(); // Reschedule for the next random interval
    });
}

async function sendMail() {
    try {
        // Create an OAuth2 URL to get the authorization code
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });

        console.log('Authorize this app by visiting this URL:', authUrl);

        const rlp = readline.default;
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

            scheduleProcessEmails()

            // Close the readline interface
            rl.close();
        });

        // Handle readline close event
        rl.on('close', () => {
            console.log('Application closed.');
        });


    }
    catch (error) {
        return error
    }

}

sendMail().then().catch(error => console.log("Error", error.message))

