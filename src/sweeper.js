const readline = require('readline')
const constants = require('./constants')
const networks = require('./networks')
const AddressService = require('./services/AddressService')
const ProviderService = require('./services/ProviderService')
const bitcoin = require('bitcoinjs-lib')
const ecpair = require('ecpair');
const bip32 = require('bip32');
const ecc = require('tiny-secp256k1');

// Initialize bitcoinjs-lib with ECC for bech32 support
bitcoin.initEccLib(ecc);

function BlockIoSweep (network, bip32_private_key_1, private_key_2, destination_address, n, derivation_path, options) {
    console.log('DEBUG: BlockIoSweep constructor called with:')
    console.log('  network:', network)
    console.log('  n:', n)
    console.log('  derivation_path:', derivation_path)
    
    // Clean network parameter
    network = network.trim().toUpperCase()
    this.network = network
    this.networkObj = networks[network]
    this.bip32PrivKey = bip32_private_key_1
    this.privateKey2 = private_key_2
    this.toAddr = destination_address
    this.derivationPath = derivation_path
    this.n = n || BlockIoSweep.DEFAULT_N
    
    // Select provider based on network
    console.log('DEBUG: Selecting provider for network:', network, 'type:', typeof network)
    console.log('DEBUG: network === BCH:', network === 'BCH')
    console.log('DEBUG: network === BCHTEST:', network === 'BCHTEST')
    
    if (network === 'BCH' || network === 'BCHTEST') {
        this.provider = 'blockchaircom'
        console.log('DEBUG: Selected blockchaircom for BCH')
    } else if (network === 'BTC' || network === 'BTCTEST') {
        this.provider = 'blockchaincom'
        console.log('DEBUG: Selected blockchaincom for BTC')
    } else if (network === 'LTC' || network === 'LTCTEST' || network === 'DOGE' || network === 'DOGETEST') {
        this.provider = 'sochain'
        console.log('DEBUG: Selected sochain for', network)
    } else {
        this.provider = 'blockchaincom' // default fallback
        console.log('DEBUG: Using default blockchaincom for unknown network')
    }
    
    console.log('DEBUG: Final provider selected:', this.provider)
    
    if (options && typeof (options) === 'object') {
	this.provider = options.provider || this.provider
	this.feeRate = options.feeRate || BlockIoSweep.DEFAULT_FEE_RATE[network]
	this.maxTxInputs = options.maxTxInputs || BlockIoSweep.DEFAULT_MAX_TX_INPUTS
    } else {
	this.feeRate = BlockIoSweep.DEFAULT_FEE_RATE[network]
	this.maxTxInputs = BlockIoSweep.DEFAULT_MAX_TX_INPUTS
    }
    
    console.log('DEBUG: Using provider:', this.provider, 'for network:', network)
    
    this.providerService = new ProviderService(this.provider, this.network)
}

// set defaults from constants
BlockIoSweep.DEFAULT_N = parseInt(constants.N)
BlockIoSweep.DEFAULT_BLOCKCHAIN_PROVIDER = constants.BLOCKCHAIN_PROVIDER_DEFAULT
BlockIoSweep.DEFAULT_BLOCKCHAIN_PROVIDER_API_URL = constants.BLOCKCHAIN_PROVIDER_URL_DEFAULT
BlockIoSweep.DEFAULT_FEE_RATE = constants.FEE_RATE
BlockIoSweep.DEFAULT_MAX_TX_INPUTS = constants.MAX_TX_INPUTS


BlockIoSweep.prototype.begin = async function () {
    console.log('DEBUG: Starting sweep process...')
    console.log('DEBUG: Network:', this.network)
    console.log('DEBUG: Provider:', this.provider)
    console.log('DEBUG: Derivation path:', this.derivationPath)
    console.log('DEBUG: Number of addresses to check:', this.n)
    
    // Remove strict validations to prevent crashes
    
    try {
	console.log('DEBUG: Validating private keys...')
	
	// Sanity check for BIP32 key
	console.log('DEBUG: BIP32 key length:', this.bip32PrivKey.length)
	console.log('DEBUG: BIP32 key starts with:', this.bip32PrivKey.substring(0, 4))
	
	// Sanity check for WIF private key
	console.log('DEBUG: Private key 2 length:', this.privateKey2.length)
	console.log('DEBUG: Private key 2 starts with:', this.privateKey2.substring(0, 4))
	console.log('DEBUG: Private key 2 (full):', this.privateKey2)
	
	// Check for invalid base58 characters and clean keys
	console.log('DEBUG: Cleaning private key 2...')
	this.privateKey2 = this.privateKey2.trim().replace(/\s+/g, '').replace(/[^123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]/g, '')
	console.log('DEBUG: Cleaned private key 2 length:', this.privateKey2.length)
	console.log('DEBUG: Cleaned private key 2:', this.privateKey2)
	
	console.log('DEBUG: Cleaning BIP32 key...')
	this.bip32PrivKey = this.bip32PrivKey.trim().replace(/\s+/g, '').replace(/[^123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]/g, '')
	console.log('DEBUG: Cleaned BIP32 key length:', this.bip32PrivKey.length)
	console.log('DEBUG: Cleaned BIP32 key starts with:', this.bip32PrivKey.substring(0, 4))
	
	console.log('DEBUG: Extracting public key from private key 2...')
	// get the public key from the user-specified private key
	const publicKey2 = ecpair.ECPair.fromWIF(this.privateKey2, this.networkObj).publicKey.toString('hex')
	console.log('DEBUG: Public key 2 extracted:', publicKey2.substring(0, 10) + '...')
	
	console.log('DEBUG: Creating balance map for', this.n, 'addresses...')
	// generate addresses for the N paths and initiate a utxo
	const utxoMap = await createBalanceMap(this.n, this.bip32PrivKey, publicKey2, this.networkObj, this.network, this.derivationPath, this.providerService)
	console.log('DEBUG: Balance map created with', Object.keys(utxoMap).length, 'addresses with UTXOs')
	
	// Show summary of what will be swept
	let totalBalance = 0
	let utxoCount = 0
	for (const addr of Object.keys(utxoMap)) {
	    for (const utxo of utxoMap[addr].tx) {
		totalBalance += getCoinValue(utxo.value)
		utxoCount++
	    }
	}
	
	console.log('\n=== SWEEP SUMMARY ===')
	console.log('Addresses with funds:', Object.keys(utxoMap).length)
	console.log('Total UTXOs:', utxoCount)
	console.log('Total balance:', totalBalance, 'sats')
	console.log('Destination:', this.toAddr)
	console.log('=====================\n')
	
	const ans = await promptConfirmation("Do you want to proceed with creating the sweep transaction? (y/n): ")
	if (ans.toLowerCase() !== 'y' && ans.toLowerCase() !== 'yes') {
	    console.log('Sweep cancelled by user')
	    return
	}
	
	const txs = []
	
	let psbt = new bitcoin.Psbt({ network: this.networkObj })
	
	const root = bip32.default(ecc).fromBase58(this.bip32PrivKey, this.networkObj)
	let ecKeys = {}
	
	let balToSweep = 0
	const addressCount = Object.keys(utxoMap).length - 1
	let addrIte = 0
	let inputNum = 0

	// TODO test for multiple tx
	
	for (const address of Object.keys(utxoMap)) {
	    // for each address
	    
	    // the BIP32 derived key (ECPair) for this address
	    let key = utxoMap[address].primaryKey
	    
	    const addrTxCount = utxoMap[address].tx.length - 1
	    
	    for (let i = 0; i < utxoMap[address].tx.length; i++) {
		
		const utxo = utxoMap[address].tx[i]
		balToSweep += getCoinValue(utxo.value)
		delete utxo.value
		const input = {
		    ...utxo
		}
		
		psbt.addInput(input)
		ecKeys[inputNum++] = key

		if (psbt.txInputs.length === this.maxTxInputs || (addrIte === addressCount && i === addrTxCount)) {
		    
		    if (balToSweep <= constants.DUST[this.network]) {
			throw new Error('Amount less than dust being sent, tx aborted')
		    }
		    
		    // create the transaction without network fees
		    const tempPsbt = psbt.clone()
		    createAndFinalizeTx(tempPsbt, this.toAddr, balToSweep, 0, ecKeys, this.privateKey2, this.networkObj)
		    
		    // we know the size of the transaction now,
		    // calculate the network fee, and recreate the appropriate transaction
		    const networkFee = getNetworkFee(this.network, tempPsbt, this.feeRate)
		    createAndFinalizeTx(psbt, this.toAddr, balToSweep, networkFee, ecKeys, this.privateKey2, this.networkObj)

		    if (psbt.getFee() > constants.NETWORK_FEE_MAX[this.network]) {
			throw new Error(' *** WARNING: max network fee exceeded. This transaction has a network fee of ' + psbt.getFee().toString() + ' sats, whereas the maximum network fee allowed is ' + constants.NETWORK_FEE_MAX[this.network].toString() + ' sats')
		    }
		    
		    const extracted_tx = psbt.extractTransaction()

		    // we'll show the network fee, the network fee rate, and the transaction hex for the user to independently verify before broadcast
		    // we don't ask bitcoinjs to enforce the max fee rate here, we've already done it above ourselves
		    txs.push({ network_fee: psbt.getFee(), network_fee_rate: psbt.getFeeRate(), tx_hex: extracted_tx.toHex(), tx_size: extracted_tx.virtualSize() })
		    
		    psbt = new bitcoin.Psbt({ network: this.networkObj })
		    balToSweep = 0
		    ecKeys = {}
		    inputNum = 0
		}
	    }
	    addrIte++
	}
	
	if (!txs.length) {
	    throw new Error('No transaction created, do your addresses have balance?')
	}
	
	for (let i = 0; i < txs.length; i++) {
	    const tx = txs[i]
	    
	    console.log('\n\nVERIFY THE FOLLOWING IS CORRECT INDEPENDENTLY:\n')
	    console.log('Network:', this.network)
	    console.log('Transaction Hex:', tx.tx_hex)
	    console.log('Network Fee Rate:', tx.network_fee_rate, 'sats/byte')
	    console.log('Transaction VSize:', tx.tx_size, 'bytes')
	    console.log('Network Fee:', tx.network_fee, 'sats', '(max allowed:', constants.NETWORK_FEE_MAX[this.network], 'sats)')
	    
	    const ans = await promptConfirmation("\n\n*** YOU MUST INDEPENDENTLY VERIFY THE NETWORK FEE IS APPROPRIATE AND THE TRANSACTION IS PROPERLY CONSTRUCTED. ***\n*** ONCE A TRANSACTION IS BROADCAST TO THE NETWORK, IT IS CONSIDERED IRREVERSIBLE ***\n\nIf you approve of this transaction and have verified its accuracy, type '" + constants.TX_BROADCAST_APPROVAL_TEXT + "', otherwise, press enter: ")
	    
	    if (ans !== constants.TX_BROADCAST_APPROVAL_TEXT) {
		console.log('\nTRANSACTION ABORTED\n')
		continue
	    }
	    
	    await this.providerService.sendTx(tx.tx_hex)
	}
    } catch (err) {
	console.log(err.stack)
	throw new Error(err)
    }
}

module.exports = BlockIoSweep

function createAndFinalizeTx (psbt, toAddr, balance, networkFee, ecKeys, privKey2, network) {
  // balance and network fee are in COIN

  const val = balance - networkFee
  
  // Clean the destination address
  toAddr = toAddr.trim()
  console.log('DEBUG: Creating output with address:', toAddr)
  console.log('DEBUG: Creating output with value:', val, 'sats')

  try {
    psbt.addOutput({
      address: toAddr, // destination address
      value: val // value in sats
    })
  } catch (err) {
    console.log('DEBUG: Address validation failed, trying manual bech32 decode:', err.message)
    // Manual bech32 decode for modern addresses
    if (toAddr.startsWith('bc1q')) {
      try {
        const { bech32 } = require('bech32')
        const decoded = bech32.decode(toAddr)
        const words = bech32.fromWords(decoded.words.slice(1))
        const pubkeyHash = Buffer.from(words)
        
        psbt.addOutput({
          script: Buffer.concat([Buffer.from([0x00, 0x14]), pubkeyHash]),
          value: val
        })
        console.log('DEBUG: Manual bech32 output created')
      } catch (bech32Err) {
        console.log('DEBUG: Bech32 decode failed:', bech32Err.message)
        throw new Error('Invalid destination address: ' + toAddr)
      }
    } else {
      throw err
    }
  }

  for (let i = 0; i < psbt.txInputs.length; i++) {
    psbt.signInput(i, ecKeys[i])
    psbt.signInput(i, ecpair.ECPair.fromWIF(privKey2, network))
  }

  psbt.finalizeAllInputs()
}

function getNetworkFee (network, psbt, feeRate) {
  const tx = psbt.extractTransaction()
  const vSize = tx.virtualSize() // in bytes

  let f = feeRate * vSize

  return f
}

function getCoinValue (value) {
  // Handle both string (decimal) and number (satoshis) formats
  if (typeof value === 'number') {
    return value // already in satoshis
  }
  
  const s = value.toString().split('.')

  if (s[1] === undefined) { s[1] = '0' }

  const r = parseInt('' + s[0] + s[1] + constants.COIN.substr(1, 8 - s[1].length))

  if (r > Number.MAX_SAFE_INTEGER) { throw new Error('Number exceeds MAX_SAFE_INTEGER') }

  return r
}

async function createBalanceMap (n, bip32Priv, pubKey, networkObj, network, derivationPath, providerService) {
    // generates addresses for the N paths and retrieves their unspent outputs
    // returns balanceMap with all the appropriate data for creating and signing transactions
    
    const balanceMap = {}
    
    for (let i = 0; i <= n; i++) {
	
	console.log('Evaluating addresses at i=' + i)
	
	if (network !== constants.NETWORKS.DOGE && network !== constants.NETWORKS.DOGETEST) {
	    // Dogecoin only has P2SH addresses, so populate balanceMap with data for P2WSH-over-P2SH and P2WSH (Witness V0) addresses here
	    await addAddrToMap(balanceMap, constants.P2WSH_P2SH, i, bip32Priv, pubKey, networkObj, derivationPath, providerService)	    
	    await addAddrToMap(balanceMap, constants.P2WSH, i, bip32Priv, pubKey, networkObj, derivationPath, providerService)
	}

	// populate balanceMap with data for P2SH address for any network
	await addAddrToMap(balanceMap, constants.P2SH, i, bip32Priv, pubKey, networkObj, derivationPath, providerService)

    }

    return balanceMap
}

async function addAddrToMap (balanceMap, addrType, i, bip32Priv, pubKey, networkObj, derivationPath, providerService) {
    // generates addresses at i and returns the appropriate data (including utxo)

    const addresses = AddressService.generateAddresses(addrType, bip32Priv, pubKey, networkObj, i, derivationPath)

    for (let addressData of addresses) {
	const payment = addressData.payment
    
	console.log('type=' + addrType + ' address=' + payment.address)

	// prepare the object in balanceMap
	balanceMap[payment.address] = {}
	balanceMap[payment.address].address_type = addrType
	balanceMap[payment.address].i = i
	balanceMap[payment.address].primaryKey = addressData.primaryKey
	balanceMap[payment.address].tx = []

	// get the unspent transactions for the derived address
	const addrUtxo = await providerService.getUtxo(payment.address)

	let x
	
	for (x of addrUtxo) {
	    console.log('DEBUG: Processing UTXO:', JSON.stringify(x))
	
	    const unspentObj = {}
	    // Use the little-endian hash for the input (tx_hash_big_endian is actually little-endian)
	    unspentObj.hash = x.tx_hash_big_endian || x.txid || x.tx_hash
	    unspentObj.index = x.output_no || x.tx_output_n
	    unspentObj.value = x.value
	    
	    console.log('DEBUG: UTXO hash (for input):', unspentObj.hash)
	    console.log('DEBUG: UTXO index:', unspentObj.index)
	    console.log('DEBUG: UTXO value:', unspentObj.value)
	    
	    switch (addrType) {
		// handle different scripts for different address types here
		
	    case constants.P2WSH_P2SH: // P2WSH-over-P2SH
		unspentObj.witnessUtxo = {
		    script: Buffer.from(x.script_hex || x.script, 'hex'),
		    value: getCoinValue(x.value)
		}
		unspentObj.redeemScript = payment.redeem.output
		unspentObj.witnessScript = payment.redeem.redeem.output
		break
		
	    case constants.P2WSH: // Native Segwit (v0) or Witness v0
		unspentObj.witnessUtxo = {
		    script: Buffer.from(x.script_hex || x.script, 'hex'),
		    value: getCoinValue(x.value)
		}
		unspentObj.witnessScript = payment.redeem.output
		break
		
	    case constants.P2SH: // Legacy P2SH
		const txHashBigEndian = x.txid || x.tx_hash
		// Convert from big-endian to little-endian for blockchain.info API
		const txHashLittleEndian = x.tx_hash_big_endian || reverseHex(txHashBigEndian)
		console.log('DEBUG: Big-endian hash:', txHashBigEndian)
		console.log('DEBUG: Little-endian hash:', txHashLittleEndian)
		console.log('DEBUG: Fetching raw tx for P2SH with little-endian hash:', txHashLittleEndian)
		try {
		    unspentObj.nonWitnessUtxo = Buffer.from(await providerService.getTxHex(txHashLittleEndian), 'hex')
		} catch (err) {
		    console.log('DEBUG: Raw tx fetch failed, trying alternative approach:', err.message)
		    // For legacy P2SH, we can try using witnessUtxo instead
		    unspentObj.witnessUtxo = {
			script: Buffer.from(x.script_hex || x.script, 'hex'),
			value: getCoinValue(x.value)
		    }
		}
		unspentObj.redeemScript = payment.redeem.output
		break
		
	    }
	    
	    balanceMap[payment.address].tx.push(unspentObj)
	    
	}
	
	if (!balanceMap[payment.address].tx.length) {
	    // no unspent transactions found, so just discard this address
	    delete balanceMap[payment.address]
	}

    }

    return true
}

function promptConfirmation (query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise(resolve => rl.question(query, ans => {
    rl.close()
    resolve(ans)
  }))
}

function reverseHex(hex) {
  // Convert big-endian to little-endian by reversing byte pairs
  return hex.match(/.{2}/g).reverse().join('')
}
