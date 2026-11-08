require('dotenv').config({ path: 'url.env' });

const express = require('express');
const app = express();

app.use(express.json());

async function sendLine(message, target) {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LINE_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
            to: target,
            messages: [{ type: 'text', text: message }]
        })
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }
}

app.post('/webhook', (req, res) => {
    // console.log('LINE WEBHOOK:', req.body);

    const events = req.body.events || [];

    events.forEach(event => {
        console.log('Received:', event.message?.text);
        console.log('ID:', event.source?.groupId || event.source?.userId);
        console.log('Expected ID:', process.env.DUMP_GROUP_ID);
    });

    events.forEach(event => {
        if (
            event.source?.groupId === process.env.DUMP_GROUP_ID &&
            event.type === 'message' &&
            event.message?.type === 'text' &&
            event.message.text.toLowerCase().includes('-ch')
            
            
        ) {
            console.log('Command -ch detected in target group!');
            sendLine(event.message.text, process.env.TEST_TWO)
                .catch(err => console.error('LINE error:', err));
        }

        else if (
            event.source?.groupId === process.env.BIG_GROUP_ID &&
            event.type === 'message' &&
            event.message?.type === 'text' &&
            event.message.text.toLowerCase().includes('-ch')
        ) {
            console.log('Command -ch detected in test group!');
            sendLine(event.message.text, process.env.ACTUAL_TARGET_GROUP_ID)
                .catch(err => console.error('LINE error:', err));
        }
    });

    res.sendStatus(200);
});

app.get('/main', async (req, res) => {
    res.send("hello, world")
})

app.listen(3000, () => {
    console.log('hey, yo')
})
