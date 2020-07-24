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
 *
 */
import * as liskPassphrase from '@liskhq/lisk-passphrase';
import * as fs from 'fs';
import * as inquirer from 'inquirer';
import * as readline from 'readline';

import { FileSystemError, ValidationError } from './error';

interface MnemonicError {
	readonly code: string;
	readonly message: string;
}

const capitalise = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const getPassphraseVerificationFailError = (displayName: string): string =>
	`${capitalise(displayName)} was not successfully repeated.`;

interface SplitSource {
	readonly sourceIdentifier: string;
	readonly sourceType: string;
}

const splitSource = (source: string): SplitSource => {
	const delimiter = ':';
	const sourceParts = source.split(delimiter);

	return {
		sourceType: sourceParts[0],
		sourceIdentifier: sourceParts.slice(1).join(delimiter),
	};
};

export const getPassphraseFromPrompt = async (
	displayName = 'passphrase',
	shouldConfirm = false,
): Promise<string> => {
	const questions = [
		{
			type: 'password',
			name: 'passphrase',
			message: `Please enter ${displayName}: `,
		},
	];
	if (shouldConfirm) {
		questions.push({
			type: 'password',
			name: 'passphraseRepeat',
			message: `Please re-enter ${displayName}: `,
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const { passphrase, passphraseRepeat } = await inquirer.prompt(questions);

	if (!passphrase || (shouldConfirm && passphrase !== passphraseRepeat)) {
		throw new ValidationError(getPassphraseVerificationFailError(displayName));
	}

	const passphraseErrors = [passphrase]
		.filter(Boolean)
		.map(pass =>
			liskPassphrase.validation
				.getPassphraseValidationErrors(pass as string)
				.filter((error: MnemonicError) => error.message),
		);

	passphraseErrors.forEach(errors => {
		if (errors.length > 0) {
			const passphraseWarning = errors
				.filter((error: MnemonicError) => error.code !== 'INVALID_MNEMONIC')
				.reduce(
					(accumulator: string, error: MnemonicError) =>
						accumulator.concat(`${error.message.replace(' Please check the passphrase.', '')} `),
					'Warning: ',
				);
			console.warn(passphraseWarning);
		}
	});

	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return passphrase;
};

const getFileDoesNotExistError = (path: string): string => `File at ${path} does not exist.`;
const getFileUnreadableError = (path: string): string => `File at ${path} could not be read.`;

const getDataFromFile = (path: string) => fs.readFileSync(path, 'utf8');

const ERROR_DATA_MISSING = 'No data was provided.';
const ERROR_DATA_SOURCE = 'Unknown data source type.';

export const isFileSource = (source?: string): boolean => {
	if (!source) {
		return false;
	}
	const delimiter = ':';
	const sourceParts = source.split(delimiter);
	if (sourceParts.length === 2 && sourceParts[0] === 'file') {
		return true;
	}

	return false;
};

// eslint-disable-next-line @typescript-eslint/require-await
export const readFileSource = async (source?: string): Promise<string> => {
	if (!source) {
		throw new ValidationError(ERROR_DATA_MISSING);
	}

	const { sourceType, sourceIdentifier: path } = splitSource(source);

	if (sourceType !== 'file') {
		throw new ValidationError(ERROR_DATA_SOURCE);
	}
	try {
		return getDataFromFile(path);
	} catch (error) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const { message } = error;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
		if (message.match(/ENOENT/)) {
			throw new FileSystemError(getFileDoesNotExistError(path));
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
		if (message.match(/EACCES/)) {
			throw new FileSystemError(getFileUnreadableError(path));
		}
		throw error;
	}
};

const DEFAULT_TIMEOUT = 100;

export const readStdIn = async (): Promise<string[]> => {
	const readFromStd = new Promise<string[]>((resolve, reject) => {
		const lines: string[] = [];
		const rl = readline.createInterface({ input: process.stdin });

		// Prevent readline hanging when command called with no input or piped
		setTimeout(() => {
			reject(new Error(`Timed out after ${DEFAULT_TIMEOUT} ms`));
		}, DEFAULT_TIMEOUT);

		const handleClose = () => {
			resolve(lines);
		};

		return rl.on('line', line => lines.push(line)).on('close', handleClose);
	});

	return readFromStd;
};
