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
import BigNum from '@liskhq/bignum';
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
		verifyAmountBalance,
	},
	constants: {
		BYTESIZES,
		MAX_TRANSACTION_AMOUNT,
		VOTE_FEE,
	},
} = transactions;
const {
	bigNumberToBuffer,
	hexToBuffer,
	intToBuffer,
	stringToBuffer,
} = cryptography;
const {
	isPositiveNumberString,
	validator,
} = liskValidator;

const PREFIX_UPVOTE = '+';
const PREFIX_UNVOTE = '-';
const MAX_VOTE_PER_ACCOUNT = 101;
const MIN_VOTE_PER_TX = 1;
const MAX_VOTE_PER_TX = 33;

export interface VoteAsset {
	// RecipientId is required to be the same as senderId as protocol
	// tslint:disable-next-line readonly-keyword
	recipientId: string;
	// Amount is kept for handling exception
	// For exceptions.votes 15449731671927352923
	readonly amount: BigNum;
	readonly votes: ReadonlyArray<string>;
}

export interface CreateVoteAssetInput {
	readonly unvotes?: ReadonlyArray<string>;
	readonly votes?: ReadonlyArray<string>;
}

export const voteAssetFormatSchema = {
	type: 'object',
	required: ['votes'],
	properties: {
		recipientId: {
			type: 'string',
			format: 'address',
		},
		amount: {
			type: 'string',
			format: 'amount',
		},
		votes: {
			type: 'array',
			minItems: MIN_VOTE_PER_TX,
			maxItems: MAX_VOTE_PER_TX,
			items: {
				type: 'string',
				format: 'signedPublicKey',
			},
			uniqueSignedPublicKeys: true,
		},
	},
};

interface RawAsset {
	readonly recipientId: string;
	readonly amount: string | number;
	readonly votes: ReadonlyArray<string>;
}

export class VoteTransaction extends BaseTransaction {
	public readonly containsUniqueData: boolean;
	public readonly asset: VoteAsset;
	public static TYPE = 3;
	public static FEE = VOTE_FEE.toString();

	public constructor(rawTransaction: unknown) {
		super(rawTransaction);
		const tx = (typeof rawTransaction === 'object' && rawTransaction !== null
			? rawTransaction
			: {}) as Partial<transactions.TransactionJSON>;
		if (tx.asset) {
			const rawAsset = tx.asset as RawAsset;
			this.asset = {
				votes: rawAsset.votes,
				recipientId: rawAsset.recipientId || this.senderId,
				amount: new BigNum(
					isPositiveNumberString(rawAsset.amount) ? rawAsset.amount : '0',
				),
			};
		} else {
			// tslint:disable-next-line no-object-literal-type-assertion
			this.asset = {} as VoteAsset;
		}
		this.containsUniqueData = true;
	}

	public assetToJSON(): object {
		return {
			votes: this.asset.votes,
			amount: this.asset.amount.toString(),
			recipientId: this.asset.recipientId,
		};
	}

	public sign(passphrase: string, secondPassphrase?: string): void {
		super.sign(passphrase, secondPassphrase);
		this.asset.recipientId = this.senderId;
	}

	// Function getBasicBytes is overriden to maintain the bytes order
	// TODO: remove after hardfork implementation
	protected getBasicBytes(): Buffer {
		const transactionType = intToBuffer(this.type, BYTESIZES.TYPE);
		const transactionTimestamp = intToBuffer(
			this.timestamp,
			BYTESIZES.TIMESTAMP,
			'little',
		);
		const transactionSenderPublicKey = hexToBuffer(this.senderPublicKey);

		// TODO: Remove on the hard fork change
		const transactionRecipientID = intToBuffer(
			this.asset.recipientId.slice(0, -1),
			BYTESIZES.RECIPIENT_ID,
		).slice(0, BYTESIZES.RECIPIENT_ID);
		const transactionAmount = bigNumberToBuffer(
			this.asset.amount.toString(),
			BYTESIZES.AMOUNT,
			'little',
		);

		const votesBuffer = stringToBuffer(this.asset.votes.join(''));

		return Buffer.concat([
			transactionType,
			transactionTimestamp,
			transactionSenderPublicKey,
			transactionRecipientID,
			transactionAmount,
			votesBuffer,
		]);
	}

	public async prepare(store: transactions.StateStorePrepare): Promise<void> {
		const publicKeyObjectArray = this.asset.votes.map(pkWithAction => {
			const publicKey = pkWithAction.slice(1);

			return {
				publicKey,
			};
		});
		const filterArray = [
			{
				address: this.senderId,
			},
			...publicKeyObjectArray,
		];

		await store.account.cache(filterArray);
	}

	protected verifyAgainstTransactions(
		transactions: ReadonlyArray<transactions.TransactionJSON>,
	): ReadonlyArray<transactions.TransactionError> {
		const sameTypeTransactions = transactions
			.filter(
				tx =>
					tx.senderPublicKey === this.senderPublicKey && tx.type === this.type,
			)
			.map(tx => new VoteTransaction(tx));
		const publicKeys = this.asset.votes.map(vote => vote.substring(1));

		return sameTypeTransactions.reduce(
			(previous, tx) => {
				const conflictingVotes = tx.asset.votes
					.map(vote => vote.substring(1))
					.filter(publicKey => publicKeys.includes(publicKey));
				if (conflictingVotes.length > 0) {
					return [
						...previous,
						new TransactionError(
							`Transaction includes conflicting votes: ${conflictingVotes.toString()}`,
							this.id,
							'.asset.votes',
						),
					];
				}

				return previous;
			},
			[] as ReadonlyArray<transactions.TransactionError>,
		);
	}

	protected validateAsset(): ReadonlyArray<transactions.TransactionError> {
		const asset = this.assetToJSON();
		const schemaErrors = validator.validate(voteAssetFormatSchema, asset);
		const errors = convertToAssetError(
			this.id,
			schemaErrors,
		) as transactions.TransactionError[];

		return errors;
	}

	protected applyAsset(store: transactions.StateStore): ReadonlyArray<transactions.TransactionError> {
		const errors: transactions.TransactionError[] = [];
		const sender = store.account.get(this.senderId);
		// Deduct amount from sender in case of exceptions
		// See issue: https://github.com/LiskHQ/lisk-elements/issues/1215
		const balanceError = verifyAmountBalance(
			this.id,
			sender,
			this.asset.amount,
			this.fee,
		);
		if (balanceError) {
			errors.push(balanceError);
		}
		const updatedSenderBalance = new BigNum(sender.balance).sub(
			this.asset.amount,
		);

		this.asset.votes.forEach(actionVotes => {
			const vote = actionVotes.substring(1);
			const voteAccount = store.account.find(
				account => account.publicKey === vote,
			);
			if (
				!voteAccount ||
				(voteAccount &&
					(voteAccount.username === undefined ||
						voteAccount.username === '' ||
						voteAccount.username === null))
			) {
				errors.push(
					new TransactionError(
						`${vote} is not a delegate.`,
						this.id,
						'.asset.votes',
					),
				);
			}
		});
		const senderVotes = sender.votedDelegatesPublicKeys || [];
		this.asset.votes.forEach(vote => {
			const action = vote.charAt(0);
			const publicKey = vote.substring(1);
			// Check duplicate votes
			if (action === PREFIX_UPVOTE && senderVotes.includes(publicKey)) {
				errors.push(
					new TransactionError(
						`${publicKey} is already voted.`,
						this.id,
						'.asset.votes',
					),
				);
				// Check non-existing unvotes
			} else if (action === PREFIX_UNVOTE && !senderVotes.includes(publicKey)) {
				errors.push(
					new TransactionError(
						`${publicKey} is not voted.`,
						this.id,
						'.asset.votes',
					),
				);
			}
		});
		const upvotes = this.asset.votes
			.filter(vote => vote.charAt(0) === PREFIX_UPVOTE)
			.map(vote => vote.substring(1));
		const unvotes = this.asset.votes
			.filter(vote => vote.charAt(0) === PREFIX_UNVOTE)
			.map(vote => vote.substring(1));
		const originalVotes = sender.votedDelegatesPublicKeys || [];
		const votedDelegatesPublicKeys: ReadonlyArray<string> = [
			...originalVotes,
			...upvotes,
		].filter(vote => !unvotes.includes(vote));
		if (votedDelegatesPublicKeys.length > MAX_VOTE_PER_ACCOUNT) {
			errors.push(
				new TransactionError(
					`Vote cannot exceed ${MAX_VOTE_PER_ACCOUNT} but has ${
						votedDelegatesPublicKeys.length
					}.`,
					this.id,
					'.asset.votes',
					votedDelegatesPublicKeys.length.toString(),
					MAX_VOTE_PER_ACCOUNT,
				),
			);
		}
		const updatedSender = {
			...sender,
			balance: updatedSenderBalance.toString(),
			votedDelegatesPublicKeys,
		};
		store.account.set(updatedSender.address, updatedSender);

		return errors;
	}

	protected undoAsset(store: transactions.StateStore): ReadonlyArray<transactions.TransactionError> {
		const errors: transactions.TransactionError[] = [];
		const sender = store.account.get(this.senderId);
		const updatedSenderBalance = new BigNum(sender.balance).add(
			this.asset.amount,
		);

		// Deduct amount from sender in case of exceptions
		// See issue: https://github.com/LiskHQ/lisk-elements/issues/1215
		if (updatedSenderBalance.gt(MAX_TRANSACTION_AMOUNT)) {
			errors.push(
				new TransactionError(
					'Invalid amount',
					this.id,
					'.amount',
					this.asset.amount.toString(),
				),
			);
		}

		const upvotes = this.asset.votes
			.filter(vote => vote.charAt(0) === PREFIX_UPVOTE)
			.map(vote => vote.substring(1));
		const unvotes = this.asset.votes
			.filter(vote => vote.charAt(0) === PREFIX_UNVOTE)
			.map(vote => vote.substring(1));
		const originalVotes = sender.votedDelegatesPublicKeys || [];
		const votedDelegatesPublicKeys: ReadonlyArray<string> = [
			...originalVotes,
			...unvotes,
		].filter(vote => !upvotes.includes(vote));
		if (votedDelegatesPublicKeys.length > MAX_VOTE_PER_ACCOUNT) {
			errors.push(
				new TransactionError(
					`Vote cannot exceed ${MAX_VOTE_PER_ACCOUNT} but has ${
						votedDelegatesPublicKeys.length
					}.`,
					this.id,
					'.asset.votes',
					votedDelegatesPublicKeys.length.toString(),
					MAX_VOTE_PER_ACCOUNT,
				),
			);
		}

		const updatedSender = {
			...sender,
			balance: updatedSenderBalance.toString(),
			votedDelegatesPublicKeys,
		};
		store.account.set(updatedSender.address, updatedSender);

		return errors;
	}
}
