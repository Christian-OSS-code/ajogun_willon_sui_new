import axios from 'axios';
import { sealConfig } from './seal_config';

export class WalrusStorageService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = sealConfig.walrusUrl;
  }

  async storeData(data: string): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/store`, {
        data,
        contentType: 'application/json'
      });

      if (response.data && response.data.id) {
        return response.data.id;
      }
      throw new Error('Failed to store data in Walrus');
    } catch (error) {
      console.error('Walrus storage error:', error);
      throw new Error(`Storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async retrieveData(storageId: string): Promise<string> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/retrieve/${storageId}`);
      
      if (response.data && response.data.data) {
        return response.data.data;
      }
      throw new Error('Failed to retrieve data from Walrus');
    } catch (error) {
      console.error('Walrus retrieval error:', error);
      throw new Error(`Retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}