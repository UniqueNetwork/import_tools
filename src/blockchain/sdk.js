const { Sdk } = require('@unique-nft/sdk');

async function createSdk(chainWsUrl, signer) {
    if (!signer) {
        throw Error('signer required');
    }

    if (!chainWsUrl) {
        throw Error('chainWsUrl required');
    }

    return Sdk.create({
        chainWsUrl,
        signer,
    });
}

module.exports = {
    createSdk
};