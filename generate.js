
const mkdirp = require('mkdirp')
const changeCase = require('change-case')
const fs = require('fs')
const peg = require('pegjs')
const grammar = fs.readFileSync('grammar.pegjs', 'utf-8')
const parser = peg.generate(grammar, { trace: false })

const types = fs.readdirSync('tmp').map(x => `tmp/${x}`)

types.forEach(t => {
  let data = JSON.parse(fs.readFileSync(t, 'utf-8'))

  if (data.type !== 'Class') return

  let text = []
  text.push(``)

  const variables = []
  const classVars = []
  const classFxns = []
  const fxns = []
  const ctors = []

  data.items.forEach(item => {
    if (item.name.match(/^(protocol|struct|typealias|enum|property list)/i)) return
    if (item.name.match(/^class [A-Z]/)) return
    if (item.name.match(/inout|\$|-|\+/)) return
    // console.log(item.name)
    try {
      const code = parser.parse(item.name)
      if (code.kind === 'variable') {
        if (code.isClass) {
          classVars.push(code)
        } else {
          variables.push(code)
        }
      } else if (code.kind === 'constructor') {
        ctors.push(code)
      } else {
        if (code.isClass) {
          classFxns.push(code)
        } else {
          fxns.push(code)
        }
      }
    } catch (e) {
      // console.log(e)
    }
  })

  if (ctors.length || variables.length || fxns.length) {
    text.push(`form ${toSlug(data.name)}`)
    if (data.desc) {
      text.push(`  note <${clean(data.desc)}>`)
    }
    text.push('')

    ctors.forEach(c => {
      console.log(JSON.stringify(c, null, 2))
      text.push(`  hook make`)
      if (c.isAsync) {
        text.push(`    wait true`)
      }
      if (c.unwrapped) {
        text.push(`    sift true`)
      }
      if (c.optional) {
        text.push(`    void true`)
      }

      if (c.heads.length) {
        text.push(``)
        c.heads.forEach(h => {
          const type = toSlug(h.type.map(x => x.name).join(''))
          text.push(`  head ${type}`)
        })
      }
      let p = 0

      if (c.params?.length) {
        text.push(``)
      }

      c.params?.forEach(h => {
        text.push(`  take ${toSlug(h.name ?? `t-${++p}`)}, name <${h.name}>`)
        if (h.type) {
          if (h.type.type) {
            const type = toSlug(h.type.type.map(x => x.name).join(''))
            let indent = ''
            if (h.type.isArray) {
              indent = '  '
              text.push(`    like list`)
              text.push(`      like ${type}`)
            }
            if (h.type.rest) {
              text.push(`    ${indent}rest take`)
            }
            if (h.type.unwrapped) {
              text.push(`    ${indent}sift take`)
            }
            if (h.type.optional) {
              text.push(`    ${indent}void take`)
            }
          } else if (h.type.isIntersection) {
            const a = toSlug(h.type.a.map(x => x.name).join(''))
            const b = toSlug(h.type.b.type.map(x => x.name).join(''))
            text.push(`    like link`)
            text.push(`      like ${a}`)
            text.push(`      like ${b}`)
          } else if (Object.keys(h.type).length) {
            throw new Error
          }
        }
      })

      text.push('')
    })
  }

  if (classVars.length || classFxns.length) {
    text.push(`bank ${toSlug(data.name)}`)

    classVars.forEach(v => {
      console.log(JSON.stringify(v, null, 2))
    })

    text.push(``)
  }


  mkdirp.sync(`apple2/${toSlug(data.name)}`)
  fs.writeFileSync(`apple2/${toSlug(data.name)}/base.link`, text.join('\n'))
})

function toSlug(x) {
  return changeCase.paramCase(x)
}

function clean(x) {
  return x.replace(/\s+/g, ' ').replace(/’/g, "'")
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
}
