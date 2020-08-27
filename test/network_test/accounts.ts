/*
 * Copyright © 2020 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */

import { Mnemonic } from '@liskhq/lisk-passphrase';
import { cryptography } from 'lisk-sdk';

export const createAccount = () => {
	const passphrase = Mnemonic.generateMnemonic();
	const { privateKey, publicKey } = cryptography.getKeys(passphrase);
	const address = cryptography.getAddressFromPublicKey(publicKey);

	return {
		passphrase,
		privateKey,
		publicKey,
		address,
	};
};

export const genesisAccount = {
	address: '0EaZ5XxKOEbJiPPBUwZ5b46uXBw=',
	publicKey: Buffer.from('D+mj8aIbVTDyf4ekFLVJ55qUC/JP3ysvBefyKu7syGo=', 'base64'),
	passphrase: 'peanut hundred pen hawk invite exclude brain chunk gadget wait wrong ready',
	balance: '10000000000000000',
	encryptedPassphrase:
		'iterations=10&cipherText=6541c04d7a46eacd666c07fbf030fef32c5db324466e3422e59818317ac5d15cfffb80c5f1e2589eaa6da4f8d611a94cba92eee86722fc0a4015a37cff43a5a699601121fbfec11ea022&iv=141edfe6da3a9917a42004be&salt=f523bba8316c45246c6ffa848b806188&tag=4ffb5c753d4a1dc96364c4a54865521a&version=1',
	password: 'elephant tree paris dragon chair galaxy',
};
