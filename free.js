const { connect } = require("puppeteer-real-browser");
const fs = require("fs");

const url = process.env.URL;
const login = process.env.LOGIN;
const senha = process.env.SENHA;
const COOKIES_PATH = "cookies.json";

const free = async () => {
  const { page, browser } = await connect({
    args: ["--start-maximized"],
    turnstile: true,
    headless: false,
    // disableXvfb: true,
    customConfig: {},
    connectOption: {
      defaultViewport: null,
    },
    plugins: [],
  });

  try {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (
        url.includes("doubleclick.net") ||
        url.includes("adservice.google.com") ||
        url.includes("googlesyndication.com")
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
      await page.setCookie(...cookies);
    }

    await page.goto(url, {
      waitUntil: "networkidle2",
    });

    await new Promise((r) => setTimeout(r, 10000));

    if ((await page.content()).includes("LOGIN")) {
      await new Promise((r) => setTimeout(r, 5000));
      await page.waitForSelector("li.login_menu_button");
      await page.click("li.login_menu_button");
      await page.waitForSelector('input[name="btc_address"]');
      await page.type('input[name="btc_address"]', login);
      await page.waitForSelector("#login_form_password");
      await page.type("#login_form_password", senha);
      await page.waitForSelector("#login_button");
      await page.click("#login_button");
      await page.waitForNavigation({ waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 5000));
      const cookies = await page.cookies();
      fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
      console.log("Cookies salvos!");
    } else {
      console.log("Já está logado.");
    }

    await page.evaluate(() => {
      document.body.style.zoom = "45%";
      window.scrollTo(0, document.body.scrollHeight);
    });

    await new Promise((r) => setTimeout(r, 10000));

    let token = null;
    let startDate = Date.now();
    while (!token && Date.now() - startDate < 30000) {
      await page.click("#freeplay_form_cf_turnstile");
      token = await page.evaluate(() => {
        try {
          let item = document.querySelector(
            '[name="cf-turnstile-response"]'
          ).value;
          return item && item.length > 20 ? item : null;
        } catch (e) {
          return null;
        }
      });
      await new Promise((r) => setTimeout(r, 1000));
    }

    await new Promise((r) => setTimeout(r, 5000));

    try {
      await page.waitForFunction(() => {
        const el = document.querySelector("#free_play_form_button");
        if (!el) return null;
        return el.style.display !== "none";
      });
      await new Promise((r) => setTimeout(r, 5000));
      await page.waitForSelector("#free_play_form_button", { visible: true });
      await page.click("#free_play_form_button", { visible: true });
    } catch (e) {
      console.log("Botão ainda não está visível.");
    }
    await new Promise((r) => setTimeout(r, 10000));
    await page.screenshot({ path: "screen.png" });
  } catch (error) {
    await page.screenshot({ path: "screen.png" });
    console.error(`Erro interno do servidor: ${error.message}`);
    await new Promise((r) => setTimeout(r, 5000));
    await free();
  } finally {
    await browser.close();
  }
};

free();
