const { Application } = require('lisk-framework');
const {
	DappTransaction,
	InTransferTransaction,
	OutTransferTransaction,
} = require('./transactions');

try {
	// We have to keep it in try/catch block as it can throw
	// exception while validating the configuration
	const config = require('./config');

	const { NETWORK } = config;
	/* eslint-disable import/no-dynamic-require */
	const genesisBlock = require(`../config/${NETWORK}/genesis_block`);

	const constants = {
		TRANSACTION_TYPES: {
			DAPP: 5,
			IN_TRANSFER: 6,
			OUT_TRANSFER: 7,
		},
	};

	const app = new Application(genesisBlock, config);

	const { TRANSACTION_TYPES } = constants;

	app.registerTransaction(TRANSACTION_TYPES.DAPP, DappTransaction);
	app.registerTransaction(TRANSACTION_TYPES.IN_TRANSFER, InTransferTransaction);
	app.registerTransaction(
		TRANSACTION_TYPES.OUT_TRANSFER,
		OutTransferTransaction
	);

	app
		.run()
		.then(() => app.logger.info('App started...'))
		.catch(error => {
			if (error instanceof Error) {
				app.logger.error('App stopped with error', error.message);
				app.logger.debug(error.stack);
			} else {
				app.logger.error('App stopped with error', error);
			}
			process.exit();
		});
} catch (e) {
	console.error('Application start error.', e);
	process.exit();
}
