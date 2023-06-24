const { Server } = require('@chainlink/ccip-read-server')
const { json, urlencoded } = require('body-parser')
const setting = require('./lib/setting')
const mysql = require('./lib/mysql')
const { ethers, BytesLike } = require('ethers')
const Resolver_abi = require('@ensdomains/ens-contracts/artifacts/contracts/resolvers/Resolver.sol/Resolver.json').abi
const Resolver = new ethers.utils.Interface(Resolver_abi)
const IResolverService_abi = require('@ensdomains/offchain-resolver-contracts/artifacts/contracts/OffchainResolver.sol/IResolverService.json').abi
const { hexConcat, Result } = require('ethers/lib/utils')

const ETH_COIN_TYPE = 60
const address = ethers.utils.computeAddress(setting.ENS_OFFCHAIN_REGISTRY_PRIVATE_KEY)
console.log('Public key (signer):', address)
const signer = new ethers.utils.SigningKey(setting.ENS_OFFCHAIN_REGISTRY_PRIVATE_KEY)

function decodeDnsName(dnsname) {
    const labels = [];
    let idx = 0;
    while (true) {
      const len = dnsname.readUInt8(idx)
      if (len === 0) break
      labels.push(dnsname.slice(idx + 1, idx + len + 1).toString('utf8'))
      idx += len + 1
    }
    return labels.join('.')
}

const queryHandlers = {
    'addr(bytes32)': async (name, _args) => {
      const { addr, ttl } = await mysql.findAddress(name, ETH_COIN_TYPE);
      return { result: [addr], ttl };
    },
    'addr(bytes32,uint256)': async (name, args) => {
      const { addr, ttl } = await mysql.findAddress(name, args[0]);
      return { result: [addr], ttl };
    },
    'text(bytes32,string)': async (name, args) => {
      const { value, ttl } = await mysql.findTextRecord(name, args[0]);
      return { result: [value], ttl };
    },
    'contenthash(bytes32)': async (name, _args) => {
      const { contenthash, ttl } = await mysql.findContentHash(name);
      return { result: [contenthash], ttl };
    },
}

async function queryDB(name, data) {
    // Parse the data nested inside the second argument to `resolve`
    const { signature, args } = Resolver.parseTransaction({ data });
  
    if (ethers.utils.nameprep(name) !== name) {
      throw new Error('Name must be normalised');
    }
  
    if (ethers.utils.namehash(name) !== args[0]) {
      throw new Error('Name does not match namehash');
    }
    const handler = queryHandlers[signature];
    if (handler === undefined) {
      throw new Error(`Unsupported query function ${signature}`);
    }
  
    const { result, ttl } = await handler(name, args.slice(1));
    return {
      result: Resolver.encodeFunctionResult(signature, result),
      validUntil: Math.floor(Date.now() / 1000 + ttl),
    };
  }

const server = new Server()
server.add(IResolverService_abi, [
    {
      type: 'resolve',
      func: async ([encodedName, data], request) => {
        const name = decodeDnsName(Buffer.from(encodedName.slice(2), 'hex'));
        // Query the database
        const { result, validUntil } = await queryDB(name, data)

        // Hash and sign the response
        let messageHash = ethers.utils.solidityKeccak256(
          ['bytes', 'address', 'uint64', 'bytes32', 'bytes32'],
          [
            '0x1900',
            request.to,
            validUntil,
            ethers.utils.keccak256(request.data || '0x'),
            ethers.utils.keccak256(result),
          ]
        )
        const sig = signer.signDigest(messageHash)
        const sigData = hexConcat([sig.r, sig.s, sig.v])
        return [result, validUntil, sigData]
      },
    },
])



const app = server.makeApp('/')
app.get('/heartbeat', async (req, res) => {
    res.json({status: 'ok'})
})
app.listen(setting.ENS_GATEWAY_PORT, () => {
	console.log("Server listening")
})