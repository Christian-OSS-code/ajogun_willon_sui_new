"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalrusStorageService = void 0;
const axios_1 = __importDefault(require("axios"));
const seal_config_1 = require("./seal_config");
class WalrusStorageService {
    constructor() {
        this.baseUrl = seal_config_1.sealConfig.walrusUrl;
    }
    async storeData(data) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/v1/store`, {
                data,
                contentType: 'application/json'
            });
            if (response.data && response.data.id) {
                return response.data.id;
            }
            throw new Error('Failed to store data in Walrus');
        }
        catch (error) {
            console.error('Walrus storage error:', error);
            throw new Error(`Storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async retrieveData(storageId) {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/api/v1/retrieve/${storageId}`);
            if (response.data && response.data.data) {
                return response.data.data;
            }
            throw new Error('Failed to retrieve data from Walrus');
        }
        catch (error) {
            console.error('Walrus retrieval error:', error);
            throw new Error(`Retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.WalrusStorageService = WalrusStorageService;
