import puppeteer from 'puppeteer'
import { setTimeout } from 'node:timers/promises'

const args = ['--no-sandbox', '--disable-setuid-sandbox']
if (process.env.PROXY_SERVER) {
    const proxy_url = new URL(process.env.PROXY_SERVER)
    proxy_url.username = ''
    proxy_url.password = ''
    args.push(`--proxy-server=${proxy_url}`.replace(/\/$/, ''))
}

const browser = await puppeteer.launch({
    defaultViewport: { width: 1080, height: 1024 },
    args,
})
const [page] = await browser.pages()
const userAgent = await browser.userAgent()
await page.setUserAgent(userAgent.replace('Headless', ''))

let recorder
try {
    recorder = await page.screencast({ path: 'recording.webm' })
} catch {
    console.warn('screencast 不支持，已跳过录屏')
}

try {
    if (process.env.PROXY_SERVER) {
        const { username, password } = new URL(process.env.PROXY_SERVER)
        if (username && password) {
            await page.authenticate({ username, password })
        }
    }

    await page.goto('https://secure.xserver.ne.jp/xapanel/login/xvps/', { waitUntil: 'domcontentloaded' })

    // 登录
    await page.waitForSelector('#memberid')
    await page.type('#memberid', process.env.EMAIL)
    await page.type('#user_password', process.env.PASSWORD)
    await page.click('button[type="submit"]')

    // VPS 明细页
    await page.waitForSelector('a[href^="/xapanel/xvps/server/detail?id="]')
    await page.click('a[href^="/xapanel/xvps/server/detail?id="]')

    // 更新按钮
    await page.waitForSelector('text=更新する')
    await page.click('text=更新する')

    // 继续免费VPS
    await page.waitForSelector('text=引き続き無料VPSの利用を継続する')
    await page.click('text=引き続き無料VPSの利用を継続する')

    // CAPTCHA 处理
    await page.waitForSelector('img[src^="data:"]')
    const body = await page.$eval('img[src^="data:"]', img => img.src)

    const code = await fetch('https://captcha-120546510085.asia-northeast1.run.app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body,
    }).then(r => r.text())

    await page.waitForSelector('[placeholder="上の画像の数字を入力"]')
    await page.type('[placeholder="上の画像の数字を入力"]', code)

    await page.waitForSelector('text=無料VPSの利用を継続する')
    await page.click('text=無料VPSの利用を継続する')

} catch (e) {
    console.error(e)
} finally {
    await setTimeout(5000)
    if (recorder) await recorder.stop()
    await browser.close()
}
