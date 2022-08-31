const {COLLECTION_SCHEMA_NAME} = require('@unique-nft/sdk/tokens');
require('@unique-nft/sdk/tokens');

const createCollection = async (sdk, address, collectionData) => {
    const {
        schemaVersion = '1.0.0',
        coverPicture,
        image,
        attributesSchema = {},
        description = 'NO_DESCROPTION',
        tokenPrefix = 'NO_TOKEN_PREFIX_GG',
        name = 'NO_NAME',
        attributesSchemaVersion = '1.0.0',
        tokenPropertyPermissions = {},
    } = collectionData;

    const collectionSchema = {
        schemaName: COLLECTION_SCHEMA_NAME.unique,
        schemaVersion,
        attributesSchemaVersion,
        image: image ?? {urlTemplate: 'some_url/{infix}.extension'},
        attributesSchema,
        coverPicture: coverPicture ?? {
            url: 'https://ipfs.uniquenetwork.dev/ipfs/QmRH5z2gXUo4YRvEgBtsfuoQwvrR3n9HbZgW91HPXmTiAa',
        },
    };

    const createArgs = {
        address,
        name,
        description,
        tokenPrefix,
        tokenPropertyPermissions,
        schema: collectionSchema,
    };

    const createResult = await sdk.collections.creation_new.submitWaitResult(createArgs);
    return createResult.parsed.collectionId;
}


module.exports = {
    createCollection
};
