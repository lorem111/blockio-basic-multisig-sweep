const constants = require('../constants')
const fetch = require('node-fetch')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const ProviderService = function (provider, network) {
  console.log('DEBUG: ProviderService constructor called with:')
  console.log('  provider:', provider)
  console.log('  network:', network)
  console.log('  available providers:', Object.values(constants.PROVIDERS))
  
  const providerIndex = Object.values(constants.PROVIDERS).indexOf(provider)
  console.log('DEBUG: Provider index:', providerIndex)
  
  if (providerIndex < 0) {
    console.log('DEBUG: Provider not found, available providers:', Object.values(constants.PROVIDERS))
    throw new Error('Blockchain provider not supported: ' + provider)
  }
  const providerKey = Object.keys(constants.PROVIDER_URLS)[providerIndex]
  console.log('DEBUG: Provider key:', providerKey)
  console.log('DEBUG: Supported networks for', providerKey + ':', constants.PROVIDER_URLS[providerKey].SUPPORT)
  
  if (constants.PROVIDER_URLS[providerKey].SUPPORT.indexOf(network) < 0) {
    console.log('DEBUG: Network', network, 'not supported by', providerKey)
    throw new Error('Network not supported by provider')
  }
  this.network = network
  this.provider = provider
  console.log('DEBUG: ProviderService initialized successfully')
}

ProviderService.prototype.getTxHex = async function (txId) {
  try {
    switch (this.provider) {
      case constants.PROVIDERS.SOCHAIN: {
        const apiUrl = [constants.PROVIDER_URLS.SOCHAIN.URL, 'get_tx', this.network, txId].join('/')
        const res = await fetchUrl(apiUrl)
        const json = await res.json()
        if (json.status === 'fail') {
          throw new Error(JSON.stringify(json.data))
        }
        return json.data.tx_hex
      }
      case constants.PROVIDERS.MEMPOOLSPACE: {
        const networkType = this.network === constants.NETWORKS.BTC ? 'api' : 'testnet/api'
        const apiUrl = [constants.PROVIDER_URLS.MEMPOOLSPACE.URL, networkType, 'tx', txId, 'hex'].join('/')
        const res = await fetchUrl(apiUrl)
        const hex = await res.text()
        if (res.status !== 200) {
          throw new Error(hex)
        }
        return hex
      }
      case constants.PROVIDERS.BLOCKCHAINCOM: {
        // Try multiple API endpoints for blockchain.info
        const endpoints = [
          constants.PROVIDER_URLS.BLOCKCHAINCOM.URL + '/rawtx/' + txId + '?format=hex',
          constants.PROVIDER_URLS.BLOCKCHAINCOM.URL + '/tx/' + txId + '?format=hex',
          'https://blockstream.info/api/tx/' + txId + '/hex'
        ]
        
        for (const apiUrl of endpoints) {
          try {
            console.log('DEBUG: Trying raw tx from:', apiUrl)
            const res = await fetch(apiUrl)
            console.log('DEBUG: Raw tx response status:', res.status)
            if (res.status === 200) {
              const hex = await res.text()
              console.log('DEBUG: Raw tx hex length:', hex.length)
              return hex
            }
          } catch (err) {
            console.log('DEBUG: Endpoint failed:', apiUrl, err.message)
          }
        }
        throw new Error('All raw transaction endpoints failed for txid: ' + txId)
      }
      default: {
        throw new Error('Could not get hex with provider: ' + this.provider)
      }
    }
  } catch (err) {
    throw new Error(err)
  }
}

ProviderService.prototype.getUtxo = async function (addr) {
  try {
    switch (this.provider) {
      case constants.PROVIDERS.SOCHAIN: {
        const apiUrl = [constants.PROVIDER_URLS.SOCHAIN.URL, 'get_tx_unspent', this.network, addr].join('/')
        const res = await fetchUrl(apiUrl)
        const json = await res.json()
        if (json.status === 'fail') {
          throw new Error(JSON.stringify(json.data))
        }
        return json.data.txs
      }
      case constants.PROVIDERS.BLOCKCHAINCOM: {
        const apiUrl = constants.PROVIDER_URLS.BLOCKCHAINCOM.URL + '/unspent?active=' + addr
        console.log('DEBUG: Fetching UTXOs from:', apiUrl)
        const res = await fetchUrl(apiUrl)
        const json = await res.json()
        console.log('DEBUG: UTXO response status:', res.status)
        console.log('DEBUG: UTXO response:', JSON.stringify(json).substring(0, 200) + '...')
        if (json.error) {
          console.log('DEBUG: API error:', json.message)
          return []
        }
        return json.unspent_outputs || []
      }
      case constants.PROVIDERS.BLOCKCHAIRCOM: {
        const apiUrl = constants.PROVIDER_URLS.BLOCKCHAIRCOM.URL + '/bitcoin-cash/dashboards/address/' + addr
        console.log('DEBUG: Fetching BCH UTXOs from:', apiUrl)
        
        // Add delay between requests to avoid rate limiting
        await delay(1000)
        
        const res = await fetchUrl(apiUrl)
        const json = await res.json()
        console.log('DEBUG: BCH UTXO response status:', res.status)
        console.log('DEBUG: BCH response:', JSON.stringify(json).substring(0, 300) + '...')
        
        if (res.status === 430) {
          console.log('DEBUG: Rate limited, waiting longer...')
          await delay(5000)
          return []
        }
        
        if (json.data && json.data[addr] && json.data[addr].utxo) {
          return json.data[addr].utxo.map(utxo => ({
            tx_hash: utxo.transaction_hash,
            tx_hash_big_endian: utxo.transaction_hash,
            tx_output_n: utxo.index,
            script: utxo.script_hex,
            value: utxo.value
          }))
        }
        return []
      }
      default: {
        throw new Error('Could not get utxo with provider: ' + this.provider)
      }
    }
  } catch (err) {
    throw new Error(err)
  }
}

ProviderService.prototype.sendTx = async function (txHex) {
  try {
    switch (this.provider) {
      case constants.PROVIDERS.SOCHAIN: {
        const apiUrl = [constants.PROVIDER_URLS.SOCHAIN.URL, 'send_tx', this.network].join('/')
        await broadcastTx(apiUrl, txHex)
        return
      }
      case constants.PROVIDERS.BLOCKCHAINCOM: {
        const apiUrl = [constants.PROVIDER_URLS.BLOCKCHAINCOM.URL, 'pushtx'].join('/')
        await broadcastTxBlockchainCom(apiUrl, txHex)
        return
      }
      default: {
        throw new Error('Could not send tx with provider: ' + this.provider)
      }
    }
  } catch (err) {
    throw new Error(err)
  }
}

module.exports = ProviderService

async function fetchUrl (url) {
  try {
    let response = await fetch(url)
    if (response.ok) {
      return response;
    } else {
      console.log(" -- retrying in 10 seconds due to status = " + response.status);
      await delay(10000);
      return await fetchUrl(url);
    }
  } catch (err) {
    throw new Error(err)
  }
}

async function broadcastTx (apiUrl, txHex) {
  try {
    let res = await fetch(apiUrl, {
      method: 'POST',
      body: JSON.stringify({ tx_hex: txHex }),
      headers: { 'Content-Type': 'application/json' }
    })
    res = await res.json()
    if (res.status === 'success') {
      console.log('Sweep Success!')
      console.log('Tx_id:', res.data.txid)
    } else {
      console.log('Sweep Failed:')
      throw new Error(JSON.stringify(res.data))
    }
  } catch (err) {
    throw new Error(err)
  }
}

async function broadcastTxBlockchainCom (apiUrl, txHex) {
  try {
    let res = await fetch(apiUrl, {
      method: 'POST',
      body: 'tx=' + txHex,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    const result = await res.text()
    if (res.status === 200) {
      console.log('Sweep Success!')
      console.log('Tx_id:', result)
    } else {
      console.log('Sweep Failed:')
      throw new Error(result)
    }
  } catch (err) {
    throw new Error(err)
  }
}
