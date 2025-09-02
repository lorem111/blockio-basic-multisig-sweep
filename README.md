# Block.io BTC Multisig Recovery Tool

*   **🔴 THIS IS BETA SOFTWARE. USE AT YOUR OWN RISK. 🔴**
*   **🔴 NEVER SHARE YOUR PRIVATE KEYS OR RUN THIS ON AN INSECURE COMPUTER. 🔴**

This is a fork of the Block.io reference sweep script, specifically modified to recover **Bitcoin (BTC)** from Basic (2-of-2) Multi-Signature wallets.

It uses the `blockchain.info` API to fetch blockchain data and broadcast the recovery transaction. This script is intended ONLY for the Bitcoin (BTC) network. Using it for other cryptocurrencies is unsupported and may result in failure or loss of funds.

I was able to successfully recover my funds from an old block.io wallet - so it served its purpose for me.

If you ended up here, gl hope it works for you too.

## Disclaimer

This software is provided "as-is," without warranty of any kind. The responsibility for verifying the transaction details and ensuring the security of your private keys rests entirely with you. By using this script, you agree that the author is not liable for any losses or damages.

If you have questions about the script or recovery in general, you can contact me loremi411@gmail.com.

## Prerequisites

**You cannot use this tool unless you have ALL of the following from your Block.io recovery sheet:**

1.  Your **`BIP32 Private Key:`** (starts with `xprv...`)
2.  Your **`Second Private Key:`** (in WIF format)
3.  A destination Bitcoin address that you control to receive the funds.

If you do not have the two private keys from Block.io, this script will not work for you.

## Installation
```bash
git clone <repository URL>
cd <directory>
npm install
```

## Usage

### Quick Start Example

#### Windows (CMD)
```cmd
set N=100 && ^
set PRIVATE_KEY1_BIP32=xprvxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx && ^
set PRIVATE_KEY2=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx && ^
set DESTINATION_ADDR=bc1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx && ^
set NETWORK=BTC && ^
set DERIVATION_PATH=m/i/0 && ^
node example.js
```

#### Linux/Mac (Bash)
```bash
N=100 \
PRIVATE_KEY1_BIP32=xprvxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
PRIVATE_KEY2=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
DESTINATION_ADDR=bc1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
NETWORK=BTC \
DERIVATION_PATH=m/i/0 \
node example.js
```

#### Interactive Mode
```bash
node example.js
# Follow the prompts to enter parameters
```

### Help
```bash
node example.js --help
```

## Parameters
* **PRIVATE_KEY1_BIP32** - Your BIP32 extended private key (required)
* **PRIVATE_KEY2** - Your second private key in WIF format (required)
* **DESTINATION_ADDR** - Where to send swept funds - supports legacy (1...) and bech32 (bc1...) addresses (required)
* **N** - Number of addresses to check (default: 100)
* **NETWORK** - BTC. (LTC, DOGE, BTCTEST, LTCTEST, DOGETEST not supported, not tested)
* **DERIVATION_PATH** - The BIP32 derivation path. (Default: m/i/0)

## Transaction Preview
Before broadcasting, you can preview transactions at:
- https://www.blockchain.com/explorer/assets/btc/decode-transaction to decode (useful, not necessary)
- https://www.blockchain.com/explorer/assets/btc/broadcast-transaction to push transaction manually (also not necessary but you can choose to)

You can review the successful runlog below to have an idea how it works - the TX is generated first and not broadcasted without your final confirmation. 
If you don't want the script to broadcast it, you can simply use it to generate the TX and broadcast it in your own preferred way.


## Supported Networks
- **BTC** - Bitcoin mainnet

## Not supported networks, will not work
- **BTCTEST** - Bitcoin testnet
- **BCH** - Bitcoin Cash mainnet
- **BCHTEST** - Bitcoin Cash testnet
- **LTC** - Litecoin mainnet
- **LTCTEST** - Litecoin testnet
- **DOGE** - Dogecoin mainnet
- **DOGETEST** - Dogecoin testnet

## Changelog

#### Key Changes in this Fork

This version has been significantly updated from the original Block.io script to ensure it works with modern Bitcoin infrastructure. Key improvements include:

- **API Provider:** Replaced the defunct SoChain API with blockchain.info for reliable BTC data.
- **Modern Address Support:** Added support for Bech32 (bc1...) addresses.
- **Key Handling:** Implemented numerous fixes for API integration, transaction creation, and key handling.
- **Interactive Mode:** Added user-friendly prompts for all parameters.
- **Pre-Broadcast Confirmation:** The script now shows you a full summary and requires explicit confirmation before broadcasting anything, giving you a final chance to verify.


## Example Runlog

The following is an example of what a successful run looks like.

```

DEBUG: Fetching UTXOs from: https://blockchain.info/unspent?active=3A...
...
=== SWEEP SUMMARY ===
Addresses with funds: 1
Total UTXOs: 1
Total balance: 123456 sats
Destination: bc1xxxxxxxxxxxxxxxxxxxxxxxxxxxx
=====================

Do you want to proceed with creating the sweep transaction? (y/n): y

VERIFY THE FOLLOWING IS CORRECT INDEPENDENTLY:

Network: BTC
Transaction Hex: 02000000000101...
Network Fee Rate: 20 sats/byte
Transaction VSize: 450 bytes
Network Fee: 9000 sats (max allowed: 30000 sats)

*** YOU MUST INDEPENDENTLY VERIFY THE NETWORK FEE IS APPROPRIATE AND THE TRANSACTION IS PROPERLY CONSTRUCTED. ***
*** ONCE A TRANSACTION IS BROADCAST, IT IS IRREVERSIBLE. ***

If you approve of this transaction, type 'I have verified this transaction, and I want to broadcast it now': I have verified this transaction, and I want to broadcast it now

Sweep Success!

Tx_id: a1b2c3d4...

```
