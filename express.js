
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

// Filter -CH materials and remember matching customers
function filterCH(text) {
    const customers = [];

    const filtered = text.split(/\r?\n\s*\r?\n/)
        .map(section => {
            const [header, ...rows] = section.trim().split(/\r?\n/);

            const matched = rows.filter(row =>
                /^\s*\S+-ch\b/i.test(row)
            );

            if (!matched.length) return null;

            const name = header.split(/ส่ง/)[0].trim();
            customers.push(name);

            return [header, ...matched].join('\n');
        })
        .filter(Boolean)
        .join('\n\n');

    return { filtered, customers };
}

const messagePairs = new Map();
const quoteTokens = new Map();
const customerNames = new Map();

// Clear message history at midnight (Thailand time)
function scheduleMidnightClear() {
    const now = new Date();
    const thailandTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);

    const nextMidnight = new Date(thailandTime);
    nextMidnight.setUTCHours(24, 0, 0, 0);

    const delay = nextMidnight - thailandTime;

    setTimeout(() => {
        messagePairs.clear();
        quoteTokens.clear();
        customerNames.clear();

        console.log('Message history cleared');

        scheduleMidnightClear();
    }, delay);
}

scheduleMidnightClear();

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
            const { filtered, customers } = filterCH(message.text);

            // Forward matching -CH rows with customer headers
            if (filtered) {
                const result = await sendLine(filtered, targetGroupId);
                const sent = result.sentMessages?.[0];

                if (sent?.id) {
                    messagePairs.set(message.id, sent.id);
                    messagePairs.set(sent.id, message.id);

                    customerNames.set(message.id, customers);

                    if (message.quoteToken) {
                        quoteTokens.set(message.id, message.quoteToken);
                    }

                    if (sent.quoteToken) {
                        quoteTokens.set(sent.id, sent.quoteToken);
                    }
                }
            }

            // Forward replies only if customer name matches
            else if (
                message.quotedMessageId &&
                messagePairs.has(message.quotedMessageId)
            ) {
                const originalId = message.quotedMessageId;
                const customers = customerNames.get(originalId) || [];

                const matches = customers.some(name =>
                    message.text.includes(name)
                );

                if (matches) {
                    const targetMessageId = messagePairs.get(originalId);
                    const targetQuoteToken = quoteTokens.get(targetMessageId);

                    if (targetQuoteToken) {
                        await sendLine(
                            message.text,
                            targetGroupId,
                            targetQuoteToken
                        );
                    }
                }
            }
        } catch (err) {
            console.error('LINE error:', err);
        }
    }

    res.sendStatus(200);
});

app.get('/main', async (req, res) => {
    res.send('hello, world');
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Server running');
});
