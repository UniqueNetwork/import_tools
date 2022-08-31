const {KeyringProvider} = require('@unique-nft/accounts/keyring');

async function getSigner(seed = '//Alice') {
    const provider = new KeyringProvider({type: 'sr25519'});
    await provider.init();
    provider.addSeed(seed);
    const account = await provider.first();
    const signer = account?.getSigner();

    if (!signer) {
        throw Error('signer required')
    }
    const address = account.instance.address;

    return {signer, address};
}

module.exports = {
    getSigner
};