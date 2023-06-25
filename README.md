# ENS Offchain Resolver

## Overview

ENS Subname is a great way to organize user-generated content within a namespace. However, the conventional way of doing so requires the root name owner to initiate an on-chain transaction for every incoming subname registration. This process can result in high gas fees for the root name owner, and therefore is hard to scale and manage in the long term.

Offchain ENS Resolver is based on CCIP Read (EIP 3668). Simply put, when an ENS root name is pointed to a custom resolver that implements OffchainResolver, a Javascript library like ethers can automatically translate a subname to an ethereum wallet address by reading from an offchain database specified in the custom resolver. Since adding records to an offchain database almost costs nothing, offchain ENS resolver is very cost-effective, scalable and manageable.

We will walk through the steps for you to host your own offchain ENS resolver to manage subnames in an offchain database.

## Step 1: Resolver Smart Contract

First, deploy a smart contract to Ethereum mainnet similar to KOLA's smart contract: [0x9d02913c7963ce018f07a4db605417a50775791a](https://etherscan.io/address/0x9d02913c7963ce018f07a4db605417a50775791a#readContract). Use the method setUrl to point to the hostname of an offchain service (more on this later!).

## Step 2: ENS Setup

[Register](https://app.ens.domains/) an ENS name if you haven't done so.
Set a custom to your root name: click the "[More](https://app.ens.domains/kolalabs.eth?tab=more)" tab, then enter your smart contract address.

## Step 3: Setup an Offchain Database

There is no limitation on database type. In our example, we use MySQL database for simplicity. The minimally required columns are:

- Subname: the string that doesn't include your root name
- Eth_Address: the wallet address that owns the subname

To be able to try out our code without modification, create the following table in MySQL database:

    CREATE TABLE `offchain_subdomains` (
      `domain` varchar(128) DEFAULT NULL,
      `subdomain` varchar(128) DEFAULT NULL,
      `eth_address` varchar(128) DEFAULT NULL
    );

## Step 4: Resolver Webserver

The code snippet in this repository is adapted from Nick Johnson's [source code](https://github.com/ensdomains/offchain-resolver/blob/main/packages/gateway/src/index.ts).

## Step 5: End-To-End Testing

1. Insert records into MySQL table manually.
2. Run the webserver on EC2. We recommend using a restarting mechanism (for example `forever`) to handle exceptions like lost database connection.
3. Make sure the port is open in security group settings (inbound).
4. Set up ELB and point to the EC2 above. Check if the target group says "Healthy".
5. Register a Route53 Cname for your ELB. Check if you can access https://<cname>.<your-domain>.com/heartbeat from your browser.
6. Manually insert test records into your database.
7. Use the following script to test subdomain resolution with ethers.js and fill in your Infura API key.

        const { Command } = require('commander')
        const ethers = require('ethers')
        const { namehash } = require('@ethersproject/hash')
        const { arrayify, BytesLike, concat, hexConcat, hexDataLength, hexDataSlice, hexlify, hexValue, hexZeroPad, isHexString } = require("@ethersproject/bytes")
        
        const program = new Command();
        program
          .requiredOption('-r --registry <address>', 'ENS registry address')
          .option('-p --provider <url>', 'web3 provider URL', 'https://mainnet.infura.io/v3/<YOUR_INFURA_API_KEY>')
          .option('-i --chainId <chainId>', 'chainId', '1')
          .option('-n --chainName <name>', 'chainName', 'mainnet')
          .argument('<name>');
        
        program.parse(process.argv);
        const options = program.opts();
        const ensAddress = options.registry;
        const chainId = parseInt(options.chainId);
        const chainName = options.chainName;
        const provider = new ethers.providers.JsonRpcProvider(options.provider, {
          chainId,
          name: chainName,
          ensAddress,
        });
        
        (async () => {
          const name = program.args[0];
          let resolver = await provider.getResolver(name);
          if (resolver) {
            const tx = {
              to: resolver.address,
              ccipReadEnabled: true,
              data: hexConcat([ '0x3b3b57de', namehash(resolver.name), "0x" ])
            };
            let res = await resolver.provider.call(tx);
            console.log(res)
            let ethAddress = await resolver.getAddress();
            console.log(`resolver address ${resolver.address}`);
            console.log(`eth address ${ethAddress}`);
          } else {
            console.log('no resolver found');
          }
        })();

8. Invoke the script like this:

        node run.js --registry 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e a.<your-ENS-name>.eth
