
const fs = require('fs')
const mkdirp = require('mkdirp')
const puppeteer = require('puppeteer')

const startUrl = 'https://developer.apple.com/documentation/foundation'//'https://developer.apple.com/documentation/technologies'

const wait = ms => new Promise((res) => setTimeout(res, ms))

start()

async function start() {
  let b = await puppeteer.launch({ headless: false })
  let p = await b.newPage()
  await p.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36")

  const stream = fs.createWriteStream('newlinks.csv', { flags: 'a+' })
  const streamv = fs.createWriteStream('visitedlinks.csv', { flags: 'a+' })

  await visit(startUrl)
  const visited = {}
  const contains = {}
  fs.readFileSync('visitedlinks.csv', 'utf-8').trim().split(/\n+/)
    .forEach(x => {
      visited[x] = true
      contains[x] = true
    })
  const urls = fs.readFileSync('newlinks.csv', 'utf-8').trim().split(/\n+/)//(await p.evaluate(getLinks))
    .filter(x => visited[x] == null)

  while (urls.length) {
    const url = urls.shift()
    if (visited[url]) continue
    await visit(url)
    visited[url] = true
    contains[url] = true
    await wait(200)
    await p.evaluate(() => {
      window.scroll({
        top: 20000,
        left: 0,
        behavior: 'smooth'
      })
    })
    try {
      await p.waitForSelector('.main', { timeout: 10000 })
    } catch (e) {
      console.log(e)
    }
    const nextLinks = await p.evaluate(getLinks)
    const nLinks = nextLinks
      .filter(x => !x.match(/[#\?]/))
      .filter(x => x.match(/documentation/))
      .filter(x => contains[x] == null)
    nLinks.forEach(x => {
      contains[x] = true
    })
    if (nLinks.length) {
      stream.write(`${nLinks.join('\n')}\n`)
    }
    urls.push(...nLinks)
    const data = await p.evaluate(find)
    if (data) {
      console.log('  :)')
      const { path } = data
      const parts = path.split('/')
      parts.shift()
      const dir = parts.join('/')
      mkdirp.sync(`${dir}`)
      fs.writeFileSync(`${dir}/data.json`, JSON.stringify(data, null, 2))
    }
    streamv.write(`${url}\n`)
  }

  function getLinks() {
    let links = []
    all('a').forEach(a => {
      links.push(a.href)
    })

    return links

    function all(s, c) {
      return Array.prototype.slice.call((c || document).querySelectorAll(s))
    }
  }

  async function visit(u) {
    console.log(u)
    try {
      await p.goto(u)
    } catch (e) {
      console.log(e)
      try {
        await b.close()
      } catch (e) {
        b = await puppeteer.launch()
        p = await b.newPage()
      }
      await visit(u)
    }
  }

  await b.close()

  function find() {
    var stuff = {
      path: window.location.pathname,
      type: document.querySelector('.eyebrow') ? document.querySelector('.eyebrow').textContent.trim() : undefined,
      name: document.querySelector('h1.title')?.textContent.trim(),
      desc: document.querySelector('.description') ? document.querySelector('.description').textContent.trim() : undefined,
      items: []
    }

    if (!stuff.type?.match(/(Class|Structure|Protocol|Object|Instance Method|Enumeration|Type Alias|Generic Initializer|Associated Type|Instance Property|Operator|Type Property)/i)) {
      return
    }
    const type = RegExp.$1
    const e = document.querySelector('#see-also')
    e?.parentNode.removeChild(e)

    if (type.match(/Object/i)) {
      all('#properties .param').forEach(a => {
        let name = a.querySelector('.property-name').textContent.trim()
        let desc = a.querySelector('.content')?.textContent.trim()
        stuff.items.push({
          name,
          desc
        })
      })
    } else {
      const code = document.querySelector('#declaration code')?.textContent.trim()
      stuff.declaration = code
      Array.prototype.slice.call(document.querySelectorAll('.topic')).forEach(x => {
        var desc = x.querySelector('.abstract .content')?.textContent.trim().replace(/\s+/g, ' ')
        var name = x.querySelector('.decorated-title')?.textContent.trim().replace(/\s+/g, ' ')
        const isDeprecated = !!x.querySelector('.badge-deprecated')
        if (isDeprecated) {
          return
        }
        if (!name) {
          return
        }
        stuff.items.push({
          name,
          desc
        })
      })
    }

    all('#relationships .contenttable-section').forEach(d => {
      const check = d.querySelector('.title')?.textContent.trim()
      if (check?.match(/Conforms To/i)) {
        stuff.conformsTo = []
        all('.relationships-item a', d).forEach(a => {
          stuff.conformsTo.push(a.textContent.trim())
        })
      } else if (check?.match(/Inherits From/i)) {
        stuff.inheritsFrom = []
        all('.relationships-item a', d).forEach(a => {
          stuff.inheritsFrom.push(a.textContent.trim())
        })
      }
    })

    return stuff

    function all(s, c) {
      return Array.prototype.slice.call((c || document).querySelectorAll(s))
    }
  }
}
