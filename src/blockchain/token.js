require('@unique-nft/sdk/tokens');

const createTokens = async (sdk, address, collectionId, data) => {
    const createTokensArgs = {
        address,
        collectionId,
        data,
    };

    const result = await sdk.tokens.createMultiple.submitWaitResult(createTokensArgs);
    return result.parsed;
}

module.exports = {
    createTokens
}
