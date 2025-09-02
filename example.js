const Sweeper = require('./src/sweeper')

function showHelp() {
  console.log(`
=== BlockIO Basic MultiSig Sweep Tool ===

Usage: node example.js [options]

Required Environment Variables:
  PRIVATE_KEY1_BIP32    - Your BIP32 extended private key (starts with xprv)
  PRIVATE_KEY2          - Your second private key in WIF format  
  DESTINATION_ADDR      - Where to send swept funds (legacy or bech32)

Optional Environment Variables:
  N                     - Number of addresses to check (default: 100)
  DERIVATION_PATH       - m/i/0 or m/0/i (default: m/i/0)
  NETWORK               - BTC, BCH, LTC, DOGE, etc. (default: BTC)

Examples:
  setx PRIVATE_KEY1_BIP32 "xprv1234..."
  setx PRIVATE_KEY2 "L1234..."  
  setx DESTINATION_ADDR "1ABC123..."
  node example.js

  Or use --help to show this message
`)
  process.exit(0)
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp()
}

const readline = require('readline')

function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  return new Promise(resolve => rl.question(question, ans => {
    rl.close()
    resolve(ans.trim())
  }))
}

async function getParameters() {
  console.log('=== BlockIO MultiSig Sweep Tool ===\n')
  
  // Network selection
  let network = process.env.NETWORK
  if (!network) {
    console.log('Available networks: BTC, BCH, LTC, DOGE, BTCTEST, BCHTEST, LTCTEST, DOGETEST')
    network = await promptUser('Select network (default: BTC): ')
    network = network || 'BTC'
  }
  
  // Keys
  let bip32 = process.env.PRIVATE_KEY1_BIP32
  if (!bip32) {
    bip32 = await promptUser('Enter BIP32 private key (xprv...): ')
  }
  
  let privkey2 = process.env.PRIVATE_KEY2
  if (!privkey2) {
    privkey2 = await promptUser('Enter second private key (WIF format): ')
  }
  
  // Destination
  let toAddr = process.env.DESTINATION_ADDR
  if (!toAddr) {
    toAddr = await promptUser('Enter destination address: ')
  }
  
  // Optional parameters
  let n = process.env.N || 100
  if (!process.env.N) {
    const nInput = await promptUser(`Number of addresses to check (default: ${n}): `)
    if (nInput) n = parseInt(nInput)
  }
  
  let derivationPath = process.env.DERIVATION_PATH || 'm/i/0'
  if (!process.env.DERIVATION_PATH) {
    const pathInput = await promptUser(`Derivation path (default: ${derivationPath}): `)
    if (pathInput) derivationPath = pathInput
  }
  
  return { n, bip32, privkey2, toAddr, network, derivationPath }
}

async function main() {
  console.log('DEBUG: Starting sweep script...')
  
  const { n, bip32, privkey2, toAddr, network, derivationPath } = await getParameters()

  console.log('\nDEBUG: Configuration:')
  console.log('  N:', n)
  console.log('  BIP32 key provided:', !!bip32)
  console.log('  Private key 2 provided:', !!privkey2)
  console.log('  Destination address provided:', !!toAddr)
  console.log('  Network:', network)
  console.log('  Derivation path:', derivationPath)

  if (!bip32 || !privkey2 || !toAddr) {
    console.log('ERROR: Missing required parameters')
    process.exit(1)
  }

  console.log('DEBUG: Creating sweeper instance...')
  const sweep = new Sweeper(network, bip32, privkey2, toAddr, n, derivationPath)

  try {
    await sweep.begin()
  } catch (err) {
    console.log(err)
  }
}

main().catch(console.error)
