const puppeteer = require("puppeteer");
const fs = require('fs');
const request = require('request');
const path = require('path');
const AnkiExport = require('anki-apkg-export').default;
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
})

readline.question(`What's your name?`, (name) => {
  console.log(`Hi ${name}!`)
  readline.close()
})

///////////////////////////////////////////////////
///////////////////////////////////////////////////
///////////////////////////////////////////////////

const useHeadless = true

let currentpage = 0
let maxpages = 5

const useLearnTemplate = 0

const learnTemplate = [
  { desire: 'deu', native: 'jpn' },
  { desire: 'jpn', native: 'eng' },
]

const downloadAudio = true

///////////////////////////////////////////////////
///////////////////////////////////////////////////
///////////////////////////////////////////////////

const desire = learnTemplate[useLearnTemplate].desire
const native = learnTemplate[useLearnTemplate].native

const decknameAnki = `tatoeba-sentences-${desire}-${native}`
const filenameAnki = `tatoeba_sentences-${desire}-${native}.apkg`
const jsonFilename = `tatoeba-crawled-${desire}-${native}.json`
const lastpageFilename = `last-crawled-page-${desire}-${native}.txt`
let oldPage = 0
let crawledData = [];
let finishedProcess = false


process.stdin.resume();


//do something when app is closing
// process.on('exit', exitHandler.bind(null,{cleanup:true}));
//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));
// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));
//catches uncaught exceptions
// process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

const outputAnki = path.join(__dirname, '/');
const outputPath = path.join(__dirname, '/crawled/');
const audioPath = path.join(__dirname, '/crawled/audio/');

if (!fs.existsSync(outputPath)){
  fs.mkdirSync(outputPath);
}
if (!fs.existsSync(audioPath)){
  fs.mkdirSync(audioPath);
}

var download = function(url, dest, callback){
  request.get(url)
  .on('error', function(err) {console.log(err)} )
  .pipe(fs.createWriteStream(dest))
  .on('close', callback);
};

async function generateDeck() {
  console.log('create anki deck')
  try {
    const apkg = new AnkiExport(decknameAnki, { template: {
      questionFormat: '{{Front}}',
      answerFormat: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}',
      css: '.card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n color: black;\nbackground-color: white;\n}\n'
    }});

    crawledData.forEach(data => {
      const audiofile = data.audio.split('/').pop()
      let front = data.sentence || ''
      let back = data.translation || ''
      let furigana = data.sentenceFurigana || ''

      if (downloadAudio) {
        apkg.addMedia(audiofile, fs.readFileSync(audioPath + audiofile));
      }

      apkg.addCard(`${front}[sound:${audiofile}]`, `${furigana} <br><br>  ${back}`);
      // apkg.addCard('card #2 front', 'card #2 back', { tags: ['nice', 'better card'] });
      // apkg.addCard('card #3 with image <img src="anki.png" />', 'card #3 back');
    })

    return new Promise((resolve, reject) => {
      apkg
      .save()
      .then(zip => {
        fs.writeFileSync(outputAnki + filenameAnki, zip, 'binary');
        resolve()
        console.log(`Package has been generated: ${filenameAnki}`);
      })
      .catch(err => {
          reject()
          console.log(err.stack || err)
        });
    })
  } catch(e) {
    console.log(e)
  }
}

const finish = async () => {
  try {
    fs.writeFileSync(outputPath + jsonFilename, JSON.stringify(crawledData, null, 2));

    fs.writeFileSync(outputPath + lastpageFilename, ''+currentpage);

    console.log('Save to file finished. last page:', currentpage);

    await generateDeck()

    await browser.close();
  } catch (e) {
    console.log(e)
  }
}

async function exitHandler(options, exitCode) {
    if (options.cleanup) console.log('clean');
    if (exitCode || exitCode === 0) {
      console.log(options, exitCode, exitCode === 'SIGINT');
    }

    if (exitCode !== 130 && exitCode !== 'SIGINT') {
      return
    }

    if (!finishedProcess) {
      console.log('catch finish')
      await finish()
      console.log('save exit')
    }

    if (options.exit) process.exit();
}


let browser = {};

(async () => {
  try {
    const oldData = await fs.readFileSync(outputPath + jsonFilename).toString();
    oldPage = await fs.readFileSync(outputPath + lastpageFilename).toString();

    if (oldData) {
      console.log('continue old file')
      crawledData = JSON.parse(oldData)
    }
    if (oldPage) {
      console.log('continue old page')
      currentpage = +oldPage
      maxpages += currentpage
    } else {
      oldPage = 0
    }
  } catch(e) {
    console.log('skip old data')
  }

  console.log('open browser')
  browser = await puppeteer.launch({ headless: useHeadless });
  const page = await browser.newPage();

  // https://tatoeba.org/deu/sentences/search?query=&from=deu&to=jpn&user=&orphans=no&unapproved=no&has_audio=yes&tags=&list=&native=&trans_filter=limit&trans_to=jpn&trans_link=&trans_user=&trans_orphan=&trans_unapproved=&trans_has_audio=&sort_reverse=yes&page=8&sort=relevance
  // https://tatoeba.org/deu/sentences/search?query=&from=deu&to=jpn&user=&orphans=no&unapproved=no&has_audio=yes&tags=&list=&native=&trans_filter=limit&trans_to=jpn&trans_link=&trans_user=&trans_orphan=&trans_unapproved=&trans_has_audio=&sort=relevance&sort_reverse=yes
  await crawlpage(page, `https://tatoeba.org/deu/sentences/search?query=&from=${desire}&to=${native}&user=&orphans=no&unapproved=no&has_audio=yes&tags=&list=&native=&trans_filter=limit&trans_to=${native}&trans_link=&trans_user=&trans_orphan=&trans_unapproved=&trans_has_audio=&sort=relevancepage=${currentpage}&sort_reverse=yes`)

  finishedProcess = true
  process.stdin.pause();

  await finish()
})();

const crawlpage = async (page, url) => {
  await page.goto(url, { waitUntil:"domcontentloaded" });
  const selector = await page.waitForSelector('[ng-if="vm.sentence.highlightedText"]', { visible: true })
  console.log('loaded')

  const res = await page.evaluate(() => {

    let mapped = [...document.querySelectorAll('[sentence-and-translations]')].map(data => {
      return {
      sentence: (data.querySelector('[ng-if="vm.sentence.highlightedText"]') || {}).innerText,
      sentenceFurigana: (data.querySelector('[ng-bind-html="transcription.html"]') || {}).innerHTML,
      id: data.querySelector('[ng-if*="vm.sentence.user"] > a').innerText.slice(1),
      audio: data.querySelector('.sentence a[href*="https://audio.tatoeba.org"]').href,
      translation: data.querySelector('.translation').querySelector('span').innerText
      }
    })

    next = document.querySelector('a[rel="next"]').href

    return {
      data: mapped,
      next: next
    }
  });

  if (downloadAudio) {
    res.data.forEach( function(data) {
      var filename =  data.audio.split('/').pop();
      console.log('Downloading ' + filename);
      download(data.audio, audioPath + filename, function(){console.log('Finished Downloading' + filename)});
    });
  }

  crawledData = [...crawledData, ...res.data]

  currentpage += 1

  if (currentpage <= maxpages) {
    console.log('crawl next site')
    await crawlpage(page, res.next)
  }
}
