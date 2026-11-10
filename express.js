require('dotenv').config({ path: 'url.env' });

const express = require('express');
const app = express();

app.use(express.json());

async function sendLine(message, target, quoteToken = null) {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LINE_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
            to: target,
            messages: [{
                type: 'text',
                text: message,
                ...(quoteToken ? { quoteToken } : {})
            }]
        })
    });


    if (!response.ok) {
        throw new Error(await response.text());
    }

    return await response.json();
}

const messagePairs = new Map();
const quoteTokens = new Map();

app.post('/webhook', async (req, res) => {
    const events = req.body.events || [];

    for (const event of events) {
        if (event.type !== 'message') continue;

        const message = event.message;
        if (message.type !== 'text') continue;

        const groupId = event.source?.groupId;
        let targetGroupId;

        if (groupId === process.env.DUMP_GROUP_ID) {
            targetGroupId = process.env.TEST_TWO;
        } else if (groupId === process.env.BIG_GROUP_ID) {
            targetGroupId = process.env.ACTUAL_TARGET_GROUP_ID;
        } else {
            continue;
        }

        try {
            // Normal message containing -ch
            if (message.text.toLowerCase().includes('-ch')) {
                const result = await sendLine(message.text, targetGroupId);

                const sent = result.sentMessages?.[0];

                if (sent?.id) {
                    messagePairs.set(message.id, sent.id);
                    messagePairs.set(sent.id, message.id);

                    if (message.quoteToken) {
                        quoteTokens.set(message.id, message.quoteToken);
                    }

                    if (sent.quoteToken) {
                        quoteTokens.set(sent.id, sent.quoteToken);
                    }
                }
            }

            // Reply to a previously forwarded message
            else if (
                message.quotedMessageId &&
                messagePairs.has(message.quotedMessageId)
            ) {
                const targetMessageId =
                    messagePairs.get(message.quotedMessageId);

                const targetQuoteToken =
                    quoteTokens.get(targetMessageId);

                if (targetQuoteToken) {
                    await sendLine(
                        message.text,
                        targetGroupId,
                        targetQuoteToken
                    );
                }
            }
        } catch (err) {
            console.error('LINE error:', err);
        }
    }

    res.sendStatus(200);
});

app.get('/main', async (req, res) => {
    res.send("hello, world")
})

app.listen(process.env.PORT || 3000, () => {
    console.log('Server running');
});
