const mysql = require('mysql')
const setting = require('./setting')
const util = require('util')

const connection = mysql.createConnection({
    host     : setting.RDS_HOSTNAME,
    user     : setting.RDS_USERNAME,
    password : setting.RDS_PASSWORD,
    port     : setting.RDS_PORT,
    database : setting.RDS_DATABASE
});
const query = util.promisify(connection.query).bind(connection)


const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const EMPTY_CONTENT_HASH = '0x'
const TTL = 86400


const findAddress = async (name, coinType) => {
    try {
        // name is <subdomain>.<domain>.eth
        let parts = name.split('.')
        if (parts.length !== 3) {
            return {addr: ZERO_ADDRESS, ttl: TTL}
        }
        let subdomain = parts[0]
        let domain = parts[1]
        let suffix = parts[2]
        if (suffix !== 'eth') {
            return {addr: ZERO_ADDRESS, ttl: TTL}
        }
        let sql = 'SELECT eth_address FROM offchain_subdomains WHERE subdomain = ? AND domain = ?'
        let r = await query(sql, [subdomain, domain])
        if (r.length === 0) {
            return {addr: ZERO_ADDRESS, ttl: TTL}
        }
        return {addr: r[0].eth_address, ttl: TTL}
    }
    catch (err) {
        console.error(err)
        return {addr: ZERO_ADDRESS, ttl: TTL}
    }
}

const findTextRecord = async (name, key) => {
    return {value: '', ttl: TTL}
}

const findContentHash = async (name) => {
    return {contenthash: EMPTY_CONTENT_HASH, ttl: TTL}
}

module.exports = { findAddress, findTextRecord, findContentHash }
