// https://www.twilio.com/blog/web-scraping-and-parsing-html-in-node-js-with-jsdomconsole.log('start')


const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fetch = require('node-fetch');

// fs = require('fs');
// fs.writeFile('helloworld.txt', 'Hello World!', function (err) {
//   if (err) return console.log(err);
//   console.log('Hello World > helloworld.txt');
// });

// window.location.href = "https://tatoeba.org/deu/sentences/search?query=&from=jpn&to=eng&user=&orphans=no&unapproved=no&has_audio=yes&tags=&list=&native=&trans_filter=limit&trans_to=&trans_link=&trans_user=&trans_orphan=&trans_unapproved=&trans_has_audio=&sort=relevance&sort_reverse=yes"

const entryUrl = "https://tatoeba.org/deu/sentences/search?query=&from=jpn&to=eng&user=&orphans=no&unapproved=no&has_audio=yes&tags=&list=&native=&trans_filter=limit&trans_to=&trans_link=&trans_user=&trans_orphan=&trans_unapproved=&trans_has_audio=&sort=relevance&sort_reverse=yes"
console.time('fetch')
fetch(entryUrl)
    .then(res => res.text())
    .then(body => {
      console.timeEnd('fetch')

      console.log(body)

      console.time('parse')
      const { document } = (new JSDOM(body)).window;
      console.timeEnd('parse')

      console.time('extract')

      console.log(document.querySelectorAll('[ng-if="vm.sentence.highlightedText"]'));

      let data = [
        [...document.querySelectorAll('[ng-if="vm.sentence.highlightedText"]')].map(t => t.innerText),
        [...document.querySelectorAll('[ng-bind-html="transcription.html"]')].map(t => t.innerHTML),
        [...document.querySelectorAll('[ng-if="vm.sentence.user && vm.sentence.user.username"] a[ng-href*="/deu/sentences/show/"]')].map(t => t.text.slice(1)),
        [...document.querySelectorAll('.sentence a[href*="https://audio.tatoeba.org"]')].map(t => t.href),
      ]
      let mapped = []
      for (let i = 0; i < data[0].length; i++) {
        mapped.push({
          sentence: data[0][i],
          sentenceFurigana: data[1][i],
          id: data[2][i],
          audio: data[3][i],
        })
      }
      console.timeEnd('extract')

      // console.log(mapped)

      next = document.querySelector('a[rel="next"]').href
      console.log(next)

    });

// document.addEventListener("DOMContentLoaded", function(event) {
//   init();
// });

function init() {
  data = [
    [...document.querySelectorAll('[ng-if="vm.sentence.highlightedText"]')].map(t => t.innerText),
    [...document.querySelectorAll('[ng-bind-html="transcription.html"]')].map(t => t.innerHTML),
    [...document.querySelectorAll('[ng-if="vm.sentence.user && vm.sentence.user.username"] a[ng-href*="/deu/sentences/show/"]')].map(t => t.text.slice(1)),
    [...document.querySelectorAll('.sentence a[href*="https://audio.tatoeba.org"]')].map(t => t.href),
  ]
  mapped = []
  for (let i = 0; i < data[0].length; i++) {
    mapped.push({
      sentence: data[0][i],
      sentenceFurigana: data[1][i],
      id: data[2][i],
      audio: data[3][i],
    })
  }
  console.log(mapped)
  next = document.querySelector('a[rel="next"]').href
  console.log(next)
}

// init();
