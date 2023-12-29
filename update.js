
require('dotenv').config()
const cloudflare = require('cloudflare')

const fs = require('fs/promises')

const { CF_TOKEN, CF_ZONE_ID } = process.env

async function main() {
    const cf = cloudflare({
        token: CF_TOKEN,
    })
    const local = JSON.parse(await fs.readFile('records.json'))
    const response = await cf.dnsRecords.browse(CF_ZONE_ID)
    const filtered = response.result
        .filter((record) => record.type === 'CNAME' && record.comment === 'github')
    const remote = Object.fromEntries(filtered.map((record) => [record.name.split('.')[0], record.content]))

    const localKeys = new Set(Object.keys(local))
    const remoteKeys = new Set(Object.keys(remote))

    const added = [...localKeys].filter((key) => !remoteKeys.has(key))
    const removed = [...remoteKeys].filter((key) => !localKeys.has(key))

    console.log(`Added: ${added.length}`)
    console.log(`Removed: ${removed.length}`)

    for (const key of added) {
        const value = local[key]
        const record = {
            type: 'CNAME',
            name: key,
            content: value,
            proxied: true,
            comment: 'github',
        }
        try {
            await cf.dnsRecords.add(CF_ZONE_ID, record)
        } catch (error) {
            console.error(error)
        }
    }

    for (const key of removed) {
        const value = remote[key]
        const record = filtered
            .find((record) => record.name.split('.')[0] === key && record.content === value)
        try {
            await cf.dnsRecords.del(CF_ZONE_ID, record.id)
        } catch (error) {
            console.error(error)
        }
    }
}

if (require.main === module) main()
