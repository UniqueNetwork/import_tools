const fs = require('fs');
const path = require('path');
require('@unique-nft/sdk/tokens');

const {createCollection} = require('./collection');
const {createTokens} = require('./token');

class ImportState {
    constructor(importer, collectionId = null, autoload = true) {
        this.importer = importer;
        this.state = null;

        if (collectionId !== null) this.setCollectionId(collectionId, autoload);
    }

    setCollectionId(collectionId, autoload = true) {
        this.filename = this.importer.getStateFilename(collectionId);
        this.state = null;
        if (autoload) this.load();
    }

    getNewState() {
        return {
            id: null,
            is_burned: false,
            is_created: false,
            has_properties: false,
            has_token_property_permissions: false,
            has_limits: false,
            has_sponsorship: false,
            changed_ownership: false,
            created_tokens: []
        }
    }

    load() {
        if (!fs.existsSync(this.filename)) {
            this.state = this.getNewState();
        } else {
            this.state = JSON.parse(fs.readFileSync(this.filename).toString());
        }
    }

    updateState(props, save = true) {
        console.log('updateState', props);
        this.state = {...this.state, ...props};
        if (save) this.save();
    }

    save() {
        fs.writeFileSync(this.filename, JSON.stringify(this.state, null, 2));
    }
}

class UniqueImporter {
    constructor(signer, sdk, importPath) {
        this.signer = signer;
        this.sdk = sdk;
        if (typeof importPath === 'undefined') importPath = '.';
        this.importPath = importPath;
    }

    getStateFilename(collectionId) {
        return path.join(this.importPath, `import_state_collection_${collectionId}.json`)
    }

    getTokensFilename(collectionId) {
        return path.join(this.importPath, `export_tokens_${collectionId}.json`);
    }

    getCollectionFilename(collectionId) {
        return path.join(this.importPath, `export_collection_${collectionId}.json`);
    }

    async createTokens(exportedCollection, exportedTokensList) {
        const exportCollectionId = exportedCollection.id;
        const importState = new ImportState(this, exportCollectionId);
        const collectionId = importState.collectionId;
        if (importState.state.created_tokens.length >= exportedCollection.tokensCount) {
            console.log(`Nothing to create. All tokens are created: ${exportedCollection.tokensCount}`)
            return;
        }

        const tokenLimit = 100;
        let tokensToMint = [];
        for (const token of exportedTokensList) {
            if (importState.state.created_tokens.includes(token.tokenId)) {
                continue;
            }

            tokensToMint.push({
                owner: token.owner.Substrate,
                image: {
                    urlInfix: 'string',
                    hash: 'string'
                },
                encodedAttributes: {},
                name: {
                    _: "Hello!",
                    en: "Hello!",
                    fr: "Bonjour!"
                },
                audio: {
                    urlInfix: 'string',
                    hash: "string"
                },
                description: {
                    _: "Hello!",
                    en: "Hello!",
                    fr: "Bonjour!"
                },
                imagePreview: {
                    urlInfix: 'string',
                    hash: 'string'
                },
                spatialObject: {
                    urlInfix: 'string',
                    hash: 'string'
                },
                video: {
                    urlInfix: 'string',
                    hash: 'string'
                },
            })

            if (tokensToMint.length >= tokenLimit) {
                const result = await createTokens(this.sdk, this.signer.address, collectionId, tokensToMint);
                importState.state.created_tokens.push(...result.map(({tokenId}) => tokenId));
                importState.save();
                tokensToMint = [];
            }
        }

        if (tokensToMint.length) {
            const result = await createTokens(this.sdk, this.signer.address, exportCollectionId, tokensToMint);
            importState.state.created_tokens.push(...result.map(({tokenId}) => tokenId));
            importState.save();
        }
    }

    async createCollection(exportedCollection) {
        const exportCollectionId = exportedCollection.id;
        const importState = new ImportState(this, exportedCollection.id);

        if (importState.state.is_created) {
            console.log(`Collection #${exportCollectionId} already imported, nothing to do`);
            return importState.state.id;
        }

        let collectionId = importState.state.id;
        if (collectionId) {
            let existedCollection = await this.sdk.collections.get(collectionId);
            if (existedCollection === null) {
                console.log('No collection with id from state, state cleared');
                importState.state = importState.getNewState();
            }
        }

        const collectionOptions = {
            name: exportedCollection.name,
            description: exportedCollection.description,
            tokenPrefix: exportedCollection.raw.tokenPrefix,
            properties: exportedCollection.raw.properties,
            tokenPropertyPermissions: exportedCollection.raw.tokenPropertyPermissions
        };

        if (exportedCollection.raw.sponsorship && exportedCollection.raw.sponsorship !== 'Disabled' && exportedCollection.raw.sponsorship.Confirmed) {
            collectionOptions.pendingSponsor = exportedCollection.raw.sponsorship.Confirmed;
        }

        const limits = {};
        for (let option of Object.keys(exportedCollection.raw.limits)) {
            if (exportedCollection.raw.limits[option] !== null) {
                limits[option] = exportedCollection.raw.limits[option];
            }
        }

        collectionId = await createCollection(this.sdk, this.signer.address, collectionOptions);
        importState.updateState({
            is_created: true, id: collectionId,
            has_properties: false, has_token_property_permissions: false,
            has_sponsorship: false, has_limits: false
        });
        console.log(`Exported collection #${exportCollectionId} now #${collectionId}`);

        // TODO: add set properties and token_property_permissions
        if (!importState.state.has_sponsorship) {
            if (!collectionOptions.pendingSponsor) {
                console.log(`No confirmed sponsorship, nothing to do, ${JSON.stringify(exportedCollection.raw.sponsorship)}`);
                importState.updateState({has_sponsorship: true});
            } else {
                const setSponsorArgs = {
                    address: this.signer.address,
                    collectionId,
                    newSponsor: collectionOptions.pendingSponsor,
                };

                const result = await this.sdk.collections.setCollectionSponsor.submitWaitResult(setSponsorArgs);
                importState.updateState({has_sponsorship: !!result});
            }
        }

        if (!importState.state.has_limits && Object.keys(limits).length > 0) {
            const limitsArgs = {
                address: this.signer.address,
                collectionId,
                limits,
            };

            const result = await this.sdk.collections.setLimits.submitWaitResult(limitsArgs);
            importState.updateState({has_limits: !!result.parsed});
        } else {
            importState.updateState({has_limits: true});
        }

        // TODO exportedCollection.permissions????'
        if (!importState.state.has_token_property_permissions && exportedCollection.permissions) {
            const args = {
                address: this.signer.address,
                collectionId,
                permissions: exportedCollection.permissions,
            };

            const result = await this.sdk.collections.setPermissions.submitWaitResult(args);
            importState.updateState({has_token_property_permissions: !!result.parsed});
        } else {
            importState.updateState({has_token_property_permissions: true});
        }

        // TODO exportedCollection.properties?????
        if (!importState.state.has_properties && exportedCollection.properties) {
            const args = {
                address: this.signer.address,
                collectionId,
                permissions: exportedCollection.properties,
            };

            const result = await this.sdk.collections.setProperties.submitWaitResult(args);
            importState.updateState({has_properties: !!result.parsed});
        } else {
            importState.updateState({has_properties: true});
        }

        return collectionId;
    }

    async changeOwnership(exportedCollection) {
        const importState = new ImportState(this, exportedCollection.id);
        const address = this.signer.address;
        const collectionId = importState.state.id;
        if (!collectionId || !address) {
            throw new Error(`CollectionId(${collectionId}) or address(${address}) required`)
        }

        if (importState.changed_ownership) {
            console.log(`Ownership for exported collection #${exportedCollection.id} already changed, nothing to do`);
            return;
        }

        let args = {address, collectionId};
        for (let admin of exportedCollection.admins) {
            await this.sdk.collections.addAdmin.submitWaitResult({...args, newAdmin: admin});
        }

        args = {
            collectionId,
            from: address,
            to: exportedCollection.normalizedOwner
        };
        await this.sdk.collections.transfer.submitWaitResult(args);
        importState.updateState({changed_ownership: true});
    }

    async import(exportedCollection, exportedTokensList) {
        if (exportedCollection.raw.mode !== 'NFT') {
            console.log('You can import only NFT collections');
            return;
        }

        await this.createCollection(exportedCollection);
        await this.createTokens(exportedCollection, exportedTokensList);
        // await this.changeOwnership(exportedCollection);
    }
}

module.exports = {
    UniqueImporter
}
