import {HumanMessage} from '@langchain/core/messages';
import app from './graph/graph'

const run = async () => {
    const initialState = {
        messages: [new HumanMessage('我需要一个关于人工智能的报告')]
    };
    
    const finalState = await app.invoke(initialState);
    
    console.log(finalState.messages[finalState.messages.length - 1].content);
}

await run();