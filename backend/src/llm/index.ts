import { ChatDeepSeek } from '@langchain/deepseek';
import dotenv from 'dotenv';

dotenv.config();

export const llm = new ChatDeepSeek({
    model: 'deepseek-chat',
    apiKey: process.env.DEEPSEEK_API_KEY,
    streaming: true,
    configuration: {
        baseURL: process.env.DEEPSEEK_BASE_URL
    },
    modelKwargs: {
        response_format: {
            type: 'json_object'
        }
    }
})
