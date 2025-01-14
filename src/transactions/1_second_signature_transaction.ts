/*
 * Copyright © 2019 Lisk Foundation
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
 *
 */
import {
	transactions,
	cryptography,
	validator as liskValidator,
} from 'lisk-sdk';
import {
	BaseTransaction,
} from './legacy_base_transaction'

const {
	convertToAssetError,
	TransactionError,
	utils: {
		getId,
	},
	constants: {
		SIGNATURE_FEE,
	},
} = transactions;
const {
	hash,
	hexToBuffer,
	signData,
} = cryptography;
const {
	validator,
} = liskValidator;

export interface SecondSignatureAsset {
	readonly publicKey: string;
}

export const secondSignatureAssetFormatSchema = {
	type: 'object',
	required: ['publicKey'],
	properties: {
		publicKey: {
			type: 'string',
			format: 'publicKey',
		},
	},
};

export class SecondSignatureTransaction extends BaseTransaction {
	public readonly asset: SecondSignatureAsset;
	public static TYPE = 1;
	public static FEE = SIGNATURE_FEE.toString();

	public constructor(rawTransaction: unknown) {
		super(rawTransaction);
		const tx = (typeof rawTransaction === 'object' && rawTransaction !== null
			? rawTransaction
			: {}) as Partial<transactions.TransactionJSON>;
		// tslint:disable-next-line no-object-literal-type-assertion
		this.asset = (tx.asset || { signature: {} }) as SecondSignatureAsset;
	}

	protected assetToBytes(): Buffer {
		const { publicKey } = this.asset;

		return hexToBuffer(publicKey);
	}

	public async prepare(store: transactions.StateStorePrepare): Promise<void> {
		await store.account.cache([
			{
				address: this.senderId,
			},
		]);
	}

	protected verifyAgainstTransactions(
		transactions: ReadonlyArray<transactions.TransactionJSON>,
	): ReadonlyArray<transactions.TransactionError> {
		return transactions
			.filter(
				tx =>
					tx.type === this.type && tx.senderPublicKey === this.senderPublicKey,
			)
			.map(
				tx =>
					new TransactionError(
						'Register second signature only allowed once per account.',
						tx.id,
						'.asset.signature',
					),
			);
	}

	protected validateAsset(): ReadonlyArray<transactions.TransactionError> {
		const schemaerrors = validator.validate(secondSignatureAssetFormatSchema, this.asset);
		const errors = convertToAssetError(
			this.id,
			schemaerrors,
		) as transactions.TransactionError[];

		return errors;
	}

	protected applyAsset(store: transactions.StateStore): ReadonlyArray<transactions.TransactionError> {
		const errors: transactions.TransactionError[] = [];
		const sender = store.account.get(this.senderId);
		// Check if secondPublicKey already exists on account
		if (sender.secondPublicKey) {
			errors.push(
				new TransactionError(
					'Register second signature only allowed once per account.',
					this.id,
					'.secondPublicKey',
				),
			);
		}
		const updatedSender = {
			...sender,
			secondPublicKey: this.asset.publicKey,
			secondSignature: 1,
		};
		store.account.set(updatedSender.address, updatedSender);

		return errors;
	}

	protected undoAsset(store: transactions.StateStore): ReadonlyArray<transactions.TransactionError> {
		const sender = store.account.get(this.senderId);
		const resetSender = {
			...sender,
			// tslint:disable-next-line no-null-keyword - Exception for compatibility with Core 1.4
			secondPublicKey: null,
			secondSignature: 0,
		};

		store.account.set(resetSender.address, resetSender);

		return [];
	}

	public sign(passphrase: string): void {
		this._signature = undefined;
		this._signSignature = undefined;
		this._signature = signData(hash(this.getBytes()), passphrase);
		this._id = getId(this.getBytes());
	}
}
