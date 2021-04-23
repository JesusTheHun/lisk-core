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

export default class HealthCheckCommand extends BaseIPCCommand {
	static description = 'Get health information from a running application.';

	static examples = [
		'health:check',
		'health:check --delay 15000'
	];

	static flags = {
		...BaseIPCCommand.flags,
		delay: flagParser.string({
			char: 'd',
			description:
				'Delay (in milliseconds) between two block for the node to be considered unhealthy',
		}),
	};

	async run(): Promise<void> {
		if (!this._client) {
			this.error('APIClient is not initialized.');
		}
		try {
			const { flags } = this.parse(HealthCheckCommand);

			const isHealthy = await this._client.invoke('health:isHealthy', {
				delayUntilUnhealthy: flags.delay
			});

			if (isHealthy) {
				this.log("healthy");
			} else {
				this.error("unhealthy")
			}

		} catch (errors) {
			const errorMessage = Array.isArray(errors)
				? errors.map(err => (err as Error).message).join(',')
				: errors;

			this.error(errorMessage);
		}
	}
}
