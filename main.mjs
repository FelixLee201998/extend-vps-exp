import puppeteer from 'puppeteer'
import { setTimeout } from 'node:timers/promises'

async function main() {
    const args = ['--no-sandbox', '--disable-setuid-sandbox']

    // 代理设置
    if (process.env.PROXY_SERVER) {
        const proxy = new URL(process.env.PROXY_SERVER)
        proxy.username = ''
        proxy.password = ''
        args.push(`--proxy-server=${proxy.href.replace(/\/$/, '')}`)
    }

    const browser = await puppeteer.launch({
        headless: false, // 要录屏必须非 headless
        defaultViewport: { width: 1080, height: 1024 },
        args,
    })

    const [page] = await browser.pages()

    // 修正 UA 去掉 Headless
    const ua = await browser.userAgent()
    await page.setUserAgent(ua.replace('Headless', ''))

    // 启动录屏（Puppeteer 22+）
    let recorder
    try {
        recorder = await page.screencast({ path: 'recording.webm' })
    } catch {
        console.warn('screencast 不支持，已跳过录屏')
    }

    try {
        // 代理账号密码
        if (process.env.PROXY_SERVER) {
            const { username, password } = new URL(process.env.PROXY_SERVER)
            if (username && password) {
                await page.authenticate({ username, password })
            }
        }

        // 打开登录页面
        await page.goto('https://secure.xserver.ne.jp/xapanel/login/xvps/', {
            waitUntil: 'domcontentloaded',
        })

        // 填写账号密码
        await page.waitForSelector('#memberid')
        await page.type('#memberid', process.env.EMAIL, { delay: 30 })

        await page.type('#user_password', process.env.PASSWORD, { delay: 30 })

        // 点击登录
        await page.click('button[type="submit"]')

        // 进入 VPS 列表页
        await page.waitForSelector('a[href^="/xapanel/xvps/server/detail?id="]')
        await page.click('a[href^="/xapanel/xvps/server/detail?id="]')

        // 更新按钮
        await page.waitForSelector('text=更新する')
        await page.click('text=更新する')

        // 点击继续使用
        await page.waitForSelector('text=引き続き無料VPSの利用を継続する')
        await page.click('text=引き続き無料VPSの利用を継続する')

        // 等待加载验证码图片
        await page.waitForSelector('img[src^="data:"]')
        const body = await page.$eval('img[src^="data:"]', img => img.src)

        // 发送验证码到识别 API
        const code = await fetch('https://captcha-120546510085.asia-northeast1.run.app', {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body
        }).then(r => r.text())

        console.log('识别验证码:', code)

        // 填入验证码
        await page.waitForSelector('[placeholder="上の画像の数字を入力"]')
        await page.type('[placeholder="上の画像の数字を入力"]', code, { delay: 50 })

        // 点击确认续期
        await page.waitForSelector('text=無料VPSの利用を継続する')
        await page.click('text=無料VPSの利用を継続する')

        console.log('续期操作已提交')

    } catch (err) {
        console.error('续期流程出错:', err)
    } finally {
        await setTimeout(5000)
        if (recorder) await recorder.stop()
        await browser.close()
    }
}

main()
