const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");
const fs = require("fs");

const token = "YOUR_BOT_TOKEN"; // Փոխարինել քո Bot token-ով
const bot = new TelegramBot(token, { polling: true });

const DASH_ADDRESS = "YOUR_DASH_ADDRESS";
const ADMIN_ID = 123456789; // Փոխարինել admin-ի Telegram ID-ով
const imagesFolder = "./images/";

if (!fs.existsSync(imagesFolder)) fs.mkdirSync(imagesFolder);

let userData = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userData[chatId] = {};
  bot.sendMessage(chatId, "Բարի գալուստ Mini App։ Ընտրեք շրջան:");
  sendRegions(chatId);
});

function sendRegions(chatId) {
  const regions = ["Կենտրոն","Մալաթիա","Կոմիտաս","Արաբկիր","Մասիվ","Աջափնյակ"];
  const opts = { reply_markup: { keyboard: regions.map(r=>[r]), one_time_keyboard:true } };
  bot.sendMessage(chatId, "Ընտրեք շրջան:", opts);
}

function sendWeights(chatId) {
  const weights = ["0.5g - $26","1.0g - $35"];
  const opts = { reply_markup: { keyboard: weights.map(w=>[w]), one_time_keyboard:true } };
  bot.sendMessage(chatId, "Ընտրեք քաշը:", opts);
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text.startsWith("/upload") && chatId==ADMIN_ID) {
    bot.sendMessage(chatId,"Խնդրում ենք ուղարկել նկարը։");
    bot.once("photo", (photoMsg)=>{
      const fileId = photoMsg.photo[photoMsg.photo.length-1].file_id;
      bot.getFileLink(fileId).then(link=>{
        const filename = `${imagesFolder}admin_latest.jpg`;
        fetch(link).then(res=>{
          const dest = fs.createWriteStream(filename);
          res.body.pipe(dest);
          bot.sendMessage(chatId,"Նկարը հաջողությամբ պահպանվել է։");
        });
      });
    });
    return;
  }

  if (!userData[chatId].region) {
    userData[chatId].region = text;
    sendWeights(chatId);
    return;
  }

  if (!userData[chatId].weight) {
    userData[chatId].weight = text;
    bot.sendMessage(chatId, `Դուք ընտրել եք ${userData[chatId].region}, քաշ ${userData[chatId].weight}`);
    bot.sendMessage(chatId, `Խնդրում ենք ուղարկել վճարումը ${DASH_ADDRESS} հասցեին և օգտագործել /checkpayment հրամանը ստուգելու համար:`);
    return;
  }
});

async function checkDashPayment() {
  const response = await fetch(`https://api.blockcypher.com/v1/dash/main/addrs/${DASH_ADDRESS}`);
  const data = await response.json();
  const txs = data.txrefs || [];
  const confirmedTx = txs.find(tx=>tx.confirmed);
  return confirmedTx ? confirmedTx.value/1e8 : 0;
}

bot.onText(/\/checkpayment/, async (msg)=>{
  const chatId = msg.chat.id;
  const paid = await checkDashPayment();
  if (paid>0) {
    const imgPath = `${imagesFolder}admin_latest.jpg`;
    if (fs.existsSync(imgPath)) {
      bot.sendPhoto(chatId, imgPath, { caption:`Վճարումը ստացվել է՝ ${paid} DASH` });
    } else {
      bot.sendMessage(chatId, `Վճարումը ստացվել է՝ ${paid} DASH (նկար դեռ չկա)`);
    }
  } else {
    bot.sendMessage(chatId,"Վճարումը դեռ չի հաստատվել։ Ստուգեք մի փոքր ուշ։");
  }
});
