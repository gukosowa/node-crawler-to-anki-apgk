///////////////////////////////////////////////////
///////////////////////////////////////////////////
///////////////////////////////////////////////////

// starting page of crawler
// this will be overwritten with the last page
// saved into /out directory
let currentpage = 0

// max pages to crawl in one run
let maxpages = 100

// use old data and append to it - todo
const useOldData = false

const clearOldData = false

const useLearnTemplate = 1
const learnTemplate = [
  { desire: 'deu', native: 'jpn' },
  { desire: 'jpn', native: 'eng' },
]

// this will download the available audio
const downloadAudio = true

// show browser or use terminal only
const useHeadless = true

// paths
const path       = require('path');
const outputAnki = path.join(__dirname, '/decks/');
const outputPath = path.join(__dirname, '/out/');
const audioPath  = path.join(__dirname, '/out/audio/');

///////////////////////////////////////////////////
///////////////////////////////////////////////////
///////////////////////////////////////////////////

process.stdin.resume();


//do something when app is closing
process.on('SIGINT', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

const puppeteer   = require("puppeteer");
const fs          = require('fs');
const request     = require('request');
const AnkiExport  = require('anki-apkg-export').default;

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

const clearFolder = (folder) => fs.readdir(folder, (err, files) => {
  if (err) throw err;

  for (const file of files) {
    fs.unlink(path.join(folder, file), err => {
      if (err) throw err;
    });
  }
});

if (!fs.existsSync(outputPath)){
  fs.mkdirSync(outputPath);
} else {
  if (clearOldData) {
    try {
      clearFolder(outputPath)
    } catch (e) {
      console.log('error on clear data')
    }
  }
}
if (!fs.existsSync(outputAnki)){
  fs.mkdirSync(outputAnki);
}
if (!fs.existsSync(audioPath)){
  fs.mkdirSync(audioPath);
} else {
  if (clearOldData) {
    try {
      clearFolder(audioPath)
    } catch (e) {
      console.log('error on clear data')
    }
  }
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
        console.log(`Deck has been generated: ${outputAnki}${filenameAnki}`);
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

    console.log('Save to file finished. last page was ', currentpage);

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
    oldPage = 0
    if (useOldData) {
      const oldData = await fs.readFileSync(outputPath + jsonFilename).toString();
      oldPage = await fs.readFileSync(outputPath + lastpageFilename).toString();

      if (oldData) {
        console.log('continue from old data')
        crawledData = JSON.parse(oldData)
      }
      if (oldPage) {
        currentpage = +oldPage
        console.log('continue from old page ' + currentpage)
        maxpages += currentpage
      } else {
        oldPage = 0
      }
    } else {
      console.log('skip old data')
    }

  } catch(e) {
    console.log('skip old data')
  }

  console.log('open puppeteer browser')
  browser = await puppeteer.launch({ headless: useHeadless });
  const page = await browser.newPage();

  // https://tatoeba.org/deu/sentences/search?query=&from=deu&to=jpn&user=&orphans=no&unapproved=no&has_audio=yes&tags=&list=&native=&trans_filter=limit&trans_to=jpn&trans_link=&trans_user=&trans_orphan=&trans_unapproved=&trans_has_audio=&sort_reverse=yes&page=8&sort=relevance
  // https://tatoeba.org/deu/sentences/search?query=&from=deu&to=jpn&user=&orphans=no&unapproved=no&has_audio=yes&tags=&list=&native=&trans_filter=limit&trans_to=jpn&trans_link=&trans_user=&trans_orphan=&trans_unapproved=&trans_has_audio=&sort=relevance&sort_reverse=yes
  await crawlpage(page, `https://tatoeba.org/deu/sentences/search?query=&from=${desire}&to=${native}&user=&orphans=no&unapproved=no&has_audio=yes&tags=&list=&native=&trans_filter=limit&trans_to=${native}&trans_link=&trans_user=&trans_orphan=&trans_unapproved=&trans_has_audio=&sort=relevancepage=${currentpage}&sort_reverse=yes`)

  finishedProcess = true
  process.stdin.pause();

  await finish()
})()

const crawlpage = async (page, url) => {
  await page.goto(url, { waitUntil:"domcontentloaded" });
  await page.waitForSelector('[ng-if="vm.sentence.highlightedText"]', { visible: true })
  console.log('page loaded')

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

    console.log('crawled data')

    return {
      data: mapped,
      next: next
    }
  });

  if (downloadAudio) {
    console.log('start downloading audio')

    let downloadPromises = []
    res.data.forEach( function(data) {
      let promise = new Promise((resolve, reject) => {
        var filename =  data.audio.split('/').pop();
        console.log('Downloading ' + filename);
        download(data.audio, audioPath + filename, () => {
          console.log('Finished Downloading' + filename)
          resolve()
        });
      })
      downloadPromises.push(promise)
    });

    await Promise.all(downloadPromises)

    console.log('finished downloading audio from page')
  }

  crawledData = [...crawledData, ...res.data]

  currentpage += 1

  if (currentpage <= maxpages) {
    console.log('crawl next site ' + currentpage)
    await crawlpage(page, res.next)
  }
}
