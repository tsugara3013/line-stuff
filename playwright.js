
require('dotenv').config({ path: 'url.env' });

const { chromium } = require('playwright');

async function processMaterials(material) {

    const browser = await chromium.launch({
        headless: true
    });

    let finalText = '';

    try {
        const page = await browser.newPage();

        // Open login page
        await page.goto('https://siamnomura.codex.co.th/signin');

        // Login
        await page.locator('input').nth(0).fill(process.env.WORK_USERNAME);
        await page.locator('input').nth(1).fill(process.env.WORK_PASSWORD);
        await page.locator('input').nth(1).press('Enter');

        // Wait until login succeeds
        const element = page.locator('.system-version-panel__sectionTitle');

        await element.first().waitFor({
            state: 'visible',
            timeout: 15000
        });

        console.log('Login successful');
        console.log('Found elements:', await element.allInnerTexts());

        // Navigate directly to stock page
        await page.goto(
            'https://siamnomura.codex.co.th/stock_on_hand_class_a'
        );

        await page.locator('.filter-input').nth(0).locator('input').fill(material[0]);

        await page.locator('.filter-input').nth(1).locator('input').fill(material[1]);

        await page.locator('.filter-input').nth(2).locator('input').fill(material[2]);

        await page.locator('.filter-input').nth(3).locator('input').fill(material[3]);

        await page.locator('.filter-input').nth(4).locator('input').fill(material[4]);

        await page.locator('.filter-input').nth(5).locator('input').fill(material[5]);

        await page.waitForTimeout(1500); // 1500 ms = 1.5 second

        await page.locator('button').nth(13).click();

        await page.locator('.ant-spin-blur').waitFor({ state: 'visible' });
        await page.locator('.ant-spin-blur').waitFor({ state: 'hidden' });
        await page.waitForTimeout(1500); // 1500 ms = 1.5 second
        

        const li = page.locator('li');
        const quota = Number(material[6]);
        const barcodes = await page.locator('.barcode').allTextContents();
        let notEnough;

        if (barcodes.length < quota) {

            if (await li.count() <= 4) {
                notEnough = barcodes.length === 0 ? "(ไม่มีของ)" : " (มีแค่นี้) ";
            } else {
                await li.nth(3).click();

                await page.locator('.ant-spin-blur').waitFor({ state: 'visible' });
                await page.locator('.ant-spin-blur').waitFor({ state: 'hidden' });
                await page.waitForTimeout(1500); // 1500 ms = 1.5 second

                const newBarcodes = await page.locator('.barcode').allTextContents();
                barcodes.push(...newBarcodes);
            }
        }

        const processedBarcodes = barcodes.map(barcode => {
            const match = barcode.match(/[A-Za-z](\d{6})/);
            return match ? match[1] : null;
        });

        let count = 1;

        for (let i = 0; i < processedBarcodes.length; i++) {
            if (processedBarcodes[i] === processedBarcodes[i + 1]) {
                count++;
            } else {
                finalText += `${processedBarcodes[i]} = ${count}\n`;
                count = 1;
            }
        }

        if (typeof notEnough !== 'undefined') {
            finalText += notEnough;
        }

        // console.log(finalText, "this is final text");

        await page.waitForLoadState('domcontentloaded');

        console.log('Current URL:', page.url());
        console.log('Page title:', await page.title());

        // Pause for manual inspection
        // await page.pause();

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }

    return finalText;
}

// if (require.main === module) {
//     const testMaterial = ['pet-ch', 'aj', 'โคโลน่า ด้านใน', '680', '12', '12000', '10'];

//     processMaterials(testMaterial)
//         .then(result => console.log(result, "this is result"))
//         .catch(console.error);
// }

module.exports = processMaterials;
