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
import BaseIPCCommand from '../../base_ipc';
import {flags as flagParser} from "@oclif/command";

export default class HealthLastBlockCommand extends BaseIPCCommand {
	static description = 'Get health metadata from a running application.';

	static examples = [
		'health:last-block',
		'health:last-block --diff'
	];

	static flags = {
		...BaseIPCCommand.flags,
		diff: flagParser.boolean({
			description:
				'Return the difference between last received block time and now',
		}),
	};

	async run(): Promise<void> {
		if (!this._client) {
			this.error('APIClient is not initialized.');
		}
		try {
			const { flags } = this.parse(HealthLastBlockCommand);

			const lastBlockReceivedAt: number = await this._client.invoke('health:lastBlockTime');

			if (lastBlockReceivedAt === undefined) {
				this.log("0");
				return;
			}

			if (flags.diff) {
				const diff = Date.now() - lastBlockReceivedAt;
				this.log(diff.toString());
			} else {
				this.log(lastBlockReceivedAt.toString())
			}

		} catch (errors) {
			const errorMessage = Array.isArray(errors)
				? errors.map(err => (err as Error).message).join(',')
				: errors;

			this.error(errorMessage);
		}
	}
}
