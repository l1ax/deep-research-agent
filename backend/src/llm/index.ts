import { ChatDeepSeek } from '@langchain/deepseek';
import dotenv from 'dotenv';

dotenv.config();

export const llm = new ChatDeepSeek({
    model: 'deepseek-v3-250324',
    apiKey: process.env.API_KEY,
    streaming: true,
    configuration: {
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3'
    },
    modelKwargs: {
        response_format: {
            type: 'json_object'
        }
    }
})