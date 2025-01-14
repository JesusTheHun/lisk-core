const { cryptography } = require('lisk-elements');
const config = require('./config.json');

const network = process.env.NETWORK || 'development';
const seedNode =
	network === 'development' ? '127.0.0.1' : `${network}-seed-01.liskdev.net`;
const GENESIS_ACCOUNT = config.genesis_account;
const ASGARD_FIXTURE = config.asgard_fixture;
const communityIdentifier = 'Lisk';
const nethash = config.genesis_block.payloadHash;
const networkIdentifier = cryptography.getNetworkIdentifier(
	nethash,
	communityIdentifier
);
const getRandomIpAddress = () => {
	const { peers } = config;
	return peers[Math.floor(Math.random() * peers.length)];
};

module.exports = {
	config,
	GENESIS_ACCOUNT,
	ASGARD_FIXTURE,
	getRandomIpAddress,
	seedNode,
	networkIdentifier,
};
