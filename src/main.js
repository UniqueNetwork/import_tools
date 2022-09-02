const fs = require('fs');
const {createSdk} = require('./blockchain/sdk');
const {getSigner} = require('./blockchain/signer');
const {UniqueImporter} = require('./blockchain/importer');
require('dotenv').config()

const main = async () => {
    const {CHAIN_WS_URL, SEED, COLLECTION_IDS} = process.env;

    if(!CHAIN_WS_URL || !SEED || !COLLECTION_IDS) {
        console.log('.env required');
        return;
    }

    let collectionIds = COLLECTION_IDS.split(',');
    collectionIds = collectionIds.map((x) => Number(x.trim())).filter((x) => !isNaN(x) && x > 0 && x !== Infinity);
    if (!collectionIds.length) {
        console.log('empty collectionIds');
        return;
    }
    const inputDir = './data';

    if(collectionIds.length < 1) {
        console.log('No collection_ids provided, exit');
        return;
    }

    const signer = await getSigner(SEED);
    if (!signer) {
        console.log(`Invalid -seed option: ${SEED}`);
        return;
    }
    const sdk = await createSdk(CHAIN_WS_URL, signer.signer);

    const importer = new UniqueImporter(signer, sdk, inputDir);
    for(let collectionId of collectionIds) {
        const collectionFile = importer.getCollectionFilename(collectionId);
        const tokensFile = importer.getTokensFilename(collectionId);
        if(!fs.existsSync(collectionFile)) {
            console.log(`No collection file (${collectionFile}), skip collection #${collectionId}`);
            continue;
        }
        if(!fs.existsSync(tokensFile)) {
            console.log(`No tokens file (${tokensFile}), skip collection #${collectionId}`);
            continue;
        }

        await importer.import(JSON.parse(fs.readFileSync(collectionFile).toString()), JSON.parse(fs.readFileSync(tokensFile).toString()));
    }
}


main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});